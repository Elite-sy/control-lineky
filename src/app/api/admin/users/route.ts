/**
 * GET /api/admin/users
 *
 * Liste tous les utilisateurs de la plateforme avec leurs workspaces et rôles.
 * Réservé aux administrateurs plateforme.
 *
 * PATCH /api/admin/users
 *
 * Actions admin sur un utilisateur :
 * - toggle-active : désactiver/réactiver un compte
 * - invite : envoyer une invitation admin directe
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { db } from '@lineky/database'
import { logger } from '@/lib/logger';
import { createClient as createSupabaseClient } from '@lineky/supabase/server'
import { logAdminAction } from '@lineky/platform-auth/audit/admin';

export const dynamic = 'force-dynamic'

// ─── GET: Tous les utilisateurs ───────────────────────────────────────────

export const GET = withAdminAuth(async (_req: NextRequest) => {
  try {
      // Récupérer tous les utilisateurs avec leurs memberships
      const users = await db.user.findMany({
        select: {
          id: true,
          authUserId: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          isActive: true,
          createdAt: true,
          memberships: {
            select: {
              role: true,
              joinedAt: true,
              workspace: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  plan: true,
                  isActive: true,
                },
              },
            },
            orderBy: { joinedAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      // Compter les stats globales
      const totalActive = users.filter(u => u.isActive).length
      const totalInactive = users.filter(u => !u.isActive).length

      // Compter les utilisateurs par workspace
      const workspaceUserCounts: Record<string, number> = {}
      users.forEach(u => {
        u.memberships.forEach(m => {
          workspaceUserCounts[m.workspace.id] = (workspaceUserCounts[m.workspace.id] || 0) + 1
        })
      })

      return NextResponse.json({
        users,
        stats: {
          total: users.length,
          totalActive,
          totalInactive,
          workspaceUserCounts,
        },
      })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[Admin Users] Error:', message)
    return NextResponse.json({ error: 'Erreur serveur', debug: message }, { status: 500 })
  }
}, 'users:read', createSupabaseClient);

// ─── PATCH: Actions admin sur un utilisateur ──────────────────────────────

export const PATCH = withAdminAuth(async (req: NextRequest, context) => {
  try {
      const body = await req.json()
      const { userId, action, ...data } = body

      if (!userId || !action) {
        return NextResponse.json({ error: 'userId et action requis' }, { status: 400 })
      }

      // Vérifier que l'utilisateur existe
      const targetUser = await db.user.findUnique({ where: { id: userId } })
      if (!targetUser) {
        return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
      }

      switch (action) {
        case 'toggle-active': {
          const updated = await db.user.update({
            where: { id: userId },
            data: { isActive: !targetUser.isActive },
          })
          
          await logAdminAction({
            action: updated.isActive ? 'activate_user' : 'deactivate_user',
            entityType: 'user',
            entityId: updated.id,
            entityTitle: updated.email || updated.fullName || updated.id,
            actorEmail: context?.adminEmail || 'system',
            details: { previousState: targetUser.isActive, newState: updated.isActive },
          });
          
          return NextResponse.json({
            success: true,
            user: { id: updated.id, email: updated.email, fullName: updated.fullName, isActive: updated.isActive },
          })
        }

        case 'change-role': {
          const { workspaceId, role: newRole } = data as { workspaceId: string; role: string }
          if (!workspaceId || !newRole) {
            return NextResponse.json({ error: 'workspaceId et role requis' }, { status: 400 })
          }
          const validRoles = ['admin', 'manager', 'member', 'user']
          if (!validRoles.includes(newRole)) {
            return NextResponse.json({ error: `Rôle invalide (${validRoles.join(', ')})` }, { status: 400 })
          }
          // Vérifier que le membership existe
          const membership = await db.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId, workspaceId } },
          })
          if (!membership) {
            return NextResponse.json({ error: 'Membre non trouvé dans ce workspace' }, { status: 404 })
          }
          const updated = await db.workspaceMember.update({
            where: { id: membership.id },
            data: { role: newRole },
          })
          
          await logAdminAction({
            action: 'change_workspace_role',
            entityType: 'workspace_member',
            entityId: updated.id,
            entityTitle: `${targetUser.email || targetUser.fullName} in workspace ${workspaceId}`,
            actorEmail: context?.adminEmail || 'system',
            workspaceId,
            details: { previousRole: membership.role, newRole, userId, workspaceId },
          });
          
          return NextResponse.json({ success: true, membership: updated })
        }

        case 'remove-from-workspace': {
          const { workspaceId } = data as { workspaceId: string }
          if (!workspaceId) {
            return NextResponse.json({ error: 'workspaceId requis' }, { status: 400 })
          }
          const membership = await db.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId, workspaceId } },
          })
          if (!membership) {
            return NextResponse.json({ error: 'Membre non trouvé dans ce workspace' }, { status: 404 })
          }
          await db.workspaceMember.delete({ where: { id: membership.id } })
          return NextResponse.json({ success: true, message: 'Utilisateur retiré du workspace' })
        }

        default:
          return NextResponse.json({ error: `Action "${action}" non supportée` }, { status: 400 })
      }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[Admin Users PATCH] Error:', message)
    return NextResponse.json({ error: 'Erreur serveur', debug: message }, { status: 500 })
  }
}, 'users:write', createSupabaseClient);
