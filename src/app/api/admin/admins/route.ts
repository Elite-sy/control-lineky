/**
 * GET /api/admin/admins
 *   List all platform admins (env var + DB)
 *
 * POST /api/admin/admins
 *   Add a new platform admin
 *   Body: { email, role? }
 *
 * PATCH /api/admin/admins
 *   Update admin role, toggle active
 *   Body: { adminId, action: 'change-role' | 'toggle-active', role? }
 *
 * DELETE /api/admin/admins
 *   Remove a platform admin
 *   Body: { adminId }
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { getPlatformAdminEmails } from '@lineky/platform-auth'
import { db } from '@lineky/database'
import { logger } from '@/lib/logger';
import { createClient as createSupabaseClient } from '@lineky/supabase/server'
import { logAdminAction } from '@lineky/platform-auth/audit/admin';

export const dynamic = 'force-dynamic'

// ─── GET: List admins ──────────────────────────────────────────────

export const GET = withAdminAuth(async (_req: NextRequest) => {
  try {
    // Get DB admins
    let dbAdmins: Array<Record<string, unknown>> = []
    try {
      dbAdmins = await db.platformAdmin.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, email: true, role: true, isActive: true,
          twoFactorEnabled: true, allowedIps: true,
          lastLoginAt: true, lastLoginIp: true,
          createdBy: true, createdAt: true, updatedAt: true,
        },
      })
    } catch {
      // Table doesn't exist yet
    }

    // Merge env var admins
    const envEmails = getPlatformAdminEmails()
    const envAdmins = envEmails.map(email => ({
      id: `env-${email}`,
      email,
      role: 'super_admin',
      isActive: true,
      twoFactorEnabled: false,
      allowedIps: null as string | null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdBy: 'PLATFORM_ADMIN_EMAILS',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      isEnv: true,
    }))

    // Deduplicate: if env email exists in DB, use DB version
    const dbEmails = new Set(dbAdmins.map(a => (a.email as string).toLowerCase()))
    const parseIps = (raw: unknown): string[] | null => {
      if (!raw) return null
      if (Array.isArray(raw)) return raw as string[]
      try { return JSON.parse(raw as string) } catch { return null }
    }
    const merged = [
      ...dbAdmins.map(a => ({ ...a, allowedIps: parseIps(a.allowedIps), isEnv: false })),
      ...envAdmins.filter(e => !dbEmails.has(e.email.toLowerCase())),
    ]

    return NextResponse.json({
      admins: merged,
      total: merged.length,
      activeCount: merged.filter(a => !!(a as Record<string, unknown>).isActive).length,
    })
  } catch (error) {
    logger.error('Error listing admins:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}, 'admins:read', createSupabaseClient);

// ─── POST: Add admin ──────────────────────────────────────────────

export const POST = withAdminAuth(async (req: NextRequest, context) => {
  try {
      const body = await req.json()
      const { email, role = 'admin' } = body

      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'Email requis' }, { status: 400 })
      }

      const normalized = email.toLowerCase().trim()

      // Check if already exists (DB or env)
      const existing = await db.platformAdmin.findUnique({ where: { email: normalized } })
      if (existing) {
        return NextResponse.json({ error: 'Cet admin existe déjà' }, { status: 409 })
      }

      if (getPlatformAdminEmails().includes(normalized)) {
        return NextResponse.json({ error: 'Cet email est déjà admin via env var' }, { status: 409 })
      }

      const admin = await db.platformAdmin.create({
        data: {
          email: normalized,
          role,
          createdBy: context?.adminEmail || 'system',
        },
      })

      await logAdminAction({
        action: 'create',
        entityType: 'platform_admin',
        entityId: admin.id,
        entityTitle: admin.email,
        actorEmail: context?.adminEmail || 'system',
        details: { role: admin.role },
      });

      return NextResponse.json({ admin, message: `Admin "${normalized}" ajouté` })
  } catch (error) {
    logger.error('Error creating admin:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'ajout' }, { status: 500 })
  }
}, 'admins:write', createSupabaseClient);

// ─── PATCH: Update admin ──────────────────────────────────────────

export const PATCH = withAdminAuth(async (req: NextRequest, context) => {
  try {
      const body = await req.json()
      const { adminId, action, role } = body

      if (!adminId || !action) {
        return NextResponse.json({ error: 'adminId et action requis' }, { status: 400 })
      }

      // Cannot modify env var admins
      if (adminId.startsWith('env-')) {
        return NextResponse.json({ error: 'Les admins env var ne peuvent pas être modifiés ici' }, { status: 400 })
      }

      const existing = await db.platformAdmin.findUnique({ where: { id: adminId } })
      if (!existing) {
        return NextResponse.json({ error: 'Admin non trouvé' }, { status: 404 })
      }

      if (action === 'toggle-active') {
        const updated = await db.platformAdmin.update({
          where: { id: adminId },
          data: { isActive: !existing.isActive },
        })
        
        await logAdminAction({
          action: updated.isActive ? 'activate' : 'deactivate',
          entityType: 'platform_admin',
          entityId: updated.id,
          entityTitle: updated.email,
          actorEmail: context?.adminEmail || 'system',
          details: { previousState: existing.isActive, newState: updated.isActive },
        });
        
        return NextResponse.json({ admin: updated, message: updated.isActive ? 'Admin réactivé' : 'Admin désactivé' })
      }

      if (action === 'change-role') {
        if (!role || !['super_admin', 'admin', 'readonly'].includes(role)) {
          return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
        }
        const updated = await db.platformAdmin.update({
          where: { id: adminId },
          data: { role },
        })
        
        await logAdminAction({
          action: 'update_role',
          entityType: 'platform_admin',
          entityId: updated.id,
          entityTitle: updated.email,
          actorEmail: context?.adminEmail || 'system',
          details: { previousRole: existing.role, newRole: role },
        });
        
        return NextResponse.json({ admin: updated, message: `Rôle changé en ${role}` })
      }

      return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })
  } catch (error) {
    logger.error('Error updating admin:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}, 'admins:write', createSupabaseClient);

// ─── DELETE: Remove admin ─────────────────────────────────────────

export const DELETE = withAdminAuth(async (req: NextRequest, context) => {
  try {
      const body = await req.json()
      const { adminId } = body

      if (!adminId) {
        return NextResponse.json({ error: 'adminId requis' }, { status: 400 })
      }

      if (adminId.startsWith('env-')) {
        return NextResponse.json({ error: 'Les admins env var ne peuvent pas être supprimés' }, { status: 400 })
      }

      const admin = await db.platformAdmin.findUnique({ where: { id: adminId } });
      if (!admin) {
        return NextResponse.json({ error: 'Admin non trouvé' }, { status: 404 })
      }

      await db.platformAdmin.delete({ where: { id: adminId } })
      
      await logAdminAction({
        action: 'delete',
        entityType: 'platform_admin',
        entityId: adminId,
        entityTitle: admin.email,
        actorEmail: context?.adminEmail || 'system',
        details: { deletedRole: admin.role },
      });
      
      return NextResponse.json({ message: 'Admin supprimé' })
  } catch (error) {
    logger.error('Error deleting admin:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}, 'admins:write', createSupabaseClient);
