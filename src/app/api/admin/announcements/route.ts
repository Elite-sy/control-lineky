/**
 * GET /api/admin/announcements
 *   List all announcements (active + inactive, newest first)
 *
 * POST /api/admin/announcements
 *   Create a new broadcast announcement
 *   Body: { title, body?, type?, priority?, startsAt?, endsAt? }
 *
 * DELETE /api/admin/announcements
 *   Delete an announcement
 *   Body: { announcementId }
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { db } from '@lineky/database'
import { logger } from '@/lib/logger';
import { logAdminAction } from '@lineky/platform-auth/audit/admin';

export const dynamic = 'force-dynamic'

// ─── GET: List announcements ──────────────────────────────────────

export const GET = withAdminAuth(async (req: NextRequest) => {
  const url = req.nextUrl.searchParams
  const activeOnly = url.get('active') === 'true'

  const where: Record<string, unknown> = activeOnly
    ? { isActive: true, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }
    : {}

  const announcements = await db.announcement.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ announcements })
}, 'announcements:read');

// ─── POST: Create announcement ───────────────────────────────────

export const POST = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const body = await req.json()
    const { title, body: message, type = 'info', priority = 0, startsAt, endsAt } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 })
    }

    const announcement = await db.announcement.create({
      data: {
        title: title.trim(),
        body: message?.trim() || null,
        type,
        priority,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        endsAt: endsAt ? new Date(endsAt) : null,
        createdBy: context?.adminEmail || 'system',
      },
    })

    await logAdminAction({
      action: 'create',
      entityType: 'announcement',
      entityId: announcement.id,
      entityTitle: announcement.title,
      actorEmail: context?.adminEmail || 'system',
      details: { type: announcement.type, priority: announcement.priority },
    });

    return NextResponse.json({ announcement, message: 'Annonce créée avec succès' })
  } catch (error) {
    logger.error('Error creating announcement:', error)
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
  }
}, 'announcements:write');

// ─── DELETE: Remove announcement ─────────────────────────────────

export const DELETE = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const body = await req.json()
    const { announcementId } = body

    if (!announcementId) {
      return NextResponse.json({ error: 'announcementId requis' }, { status: 400 })
    }

    const announcement = await db.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement) {
      return NextResponse.json({ error: 'Annonce non trouvée' }, { status: 404 })
    }

    await db.announcement.delete({ where: { id: announcementId } })
    
    await logAdminAction({
      action: 'delete',
      entityType: 'announcement',
      entityId: announcementId,
      entityTitle: announcement.title,
      actorEmail: context?.adminEmail || 'system',
      details: { type: announcement.type },
    });
    
    return NextResponse.json({ message: 'Annonce supprimée' })
  } catch (error) {
    logger.error('Error deleting announcement:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}, 'announcements:write');

// ─── PATCH: Toggle active / update announcement ──────────────────

export const PATCH = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const body = await req.json()
    const { announcementId, action } = body

    if (!announcementId || !action) {
      return NextResponse.json({ error: 'announcementId et action requis' }, { status: 400 })
    }

    if (action === 'toggle-active') {
      const ann = await db.announcement.findUnique({ where: { id: announcementId } })
      if (!ann) {
        return NextResponse.json({ error: 'Annonce non trouvée' }, { status: 404 })
      }
      const updated = await db.announcement.update({
        where: { id: announcementId },
        data: { isActive: !ann.isActive },
      })
      
      await logAdminAction({
        action: updated.isActive ? 'activate' : 'deactivate',
        entityType: 'announcement',
        entityId: updated.id,
        entityTitle: updated.title,
        actorEmail: context?.adminEmail || 'system',
        details: { previousState: ann.isActive, newState: updated.isActive },
      });
      
      return NextResponse.json({ message: ann.isActive ? 'Annonce désactivée' : 'Annonce réactivée' })
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })
  } catch (error) {
    logger.error('Error toggling announcement:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}, 'announcements:write');
