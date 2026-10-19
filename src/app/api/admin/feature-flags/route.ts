/**
 * GET /api/admin/feature-flags
 *   List all feature flags
 *
 * POST /api/admin/feature-flags
 *   Create a new feature flag
 *   Body: { key, name, description?, isEnabled?, planOverride?, rollout? }
 *
 * PATCH /api/admin/feature-flags
 *   Update a feature flag
 *   Body: { flagId, action: 'toggle' | 'update', ...fields }
 *
 * DELETE /api/admin/feature-flags
 *   Delete a feature flag
 *   Body: { flagId }
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { db } from '@lineky/database'
import { logger } from '@/lib/logger';
import { logAdminAction } from '@lineky/platform-auth/audit/admin';

export const dynamic = 'force-dynamic'

// ─── GET: List all feature flags ──────────────────────────────────

export const GET = withAdminAuth(async (_req: NextRequest) => {
  const flags = await db.featureFlag.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ flags })
}, 'feature-flags:read');

// ─── POST: Create feature flag ────────────────────────────────────

export const POST = withAdminAuth(async (req: NextRequest, context) => {
  try {
      const body = await req.json()
      const { key, name, description, isEnabled = true, planOverride, rollout = 100 } = body

      if (!key || !name) {
        return NextResponse.json({ error: 'key et name sont requis' }, { status: 400 })
      }

      const existing = await db.featureFlag.findUnique({ where: { key } })
      if (existing) {
        return NextResponse.json({ error: 'Cette clé existe déjà' }, { status: 409 })
      }

      const flag = await db.featureFlag.create({
        data: {
          key: key.trim().replace(/\s+/g, '_').toLowerCase(),
          name: name.trim(),
          description: description?.trim() || null,
          isEnabled,
          planOverride: planOverride || null,
          rollout: Math.min(100, Math.max(0, rollout)),
          createdBy: context?.adminEmail || 'system',
        },
      })

      await logAdminAction({
        action: 'create',
        entityType: 'feature_flag',
        entityId: flag.id,
        entityTitle: flag.key,
        actorEmail: context?.adminEmail || 'system',
        details: { name: flag.name, isEnabled: flag.isEnabled, rollout: flag.rollout },
      });

      return NextResponse.json({ flag, message: 'Feature flag créé' })
  } catch (error) {
    logger.error('Error creating feature flag:', error)
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
  }
}, 'feature-flags:write');

// ─── PATCH: Toggle / Update feature flag ──────────────────────────

export const PATCH = withAdminAuth(async (req: NextRequest, context) => {
  try {
      const body = await req.json()
      const { flagId, action, ...updates } = body

      if (!flagId || !action) {
        return NextResponse.json({ error: 'flagId et action requis' }, { status: 400 })
      }

      const existing = await db.featureFlag.findUnique({ where: { id: flagId } })
      if (!existing) {
        return NextResponse.json({ error: 'Feature flag non trouvé' }, { status: 404 })
      }

      if (action === 'toggle') {
        const updated = await db.featureFlag.update({
          where: { id: flagId },
          data: { isEnabled: !existing.isEnabled },
        })
        
        await logAdminAction({
          action: 'toggle',
          entityType: 'feature_flag',
          entityId: updated.id,
          entityTitle: updated.key,
          actorEmail: context?.adminEmail || 'system',
          details: { previousState: existing.isEnabled, newState: updated.isEnabled },
        });
        
        return NextResponse.json({ flag: updated, message: updated.isEnabled ? 'Feature activée' : 'Feature désactivée' })
      }

      if (action === 'update') {
        const allowedFields: Record<string, unknown> = {}
        if (updates.name !== undefined) allowedFields.name = updates.name
        if (updates.description !== undefined) allowedFields.description = updates.description
        if (updates.isEnabled !== undefined) allowedFields.isEnabled = updates.isEnabled
        if (updates.planOverride !== undefined) allowedFields.planOverride = updates.planOverride
        if (updates.rollout !== undefined) allowedFields.rollout = Math.min(100, Math.max(0, updates.rollout))

        const updated = await db.featureFlag.update({
          where: { id: flagId },
          data: allowedFields,
        })
        
        await logAdminAction({
          action: 'update',
          entityType: 'feature_flag',
          entityId: updated.id,
          entityTitle: updated.key,
          actorEmail: context?.adminEmail || 'system',
          details: { updatedFields: Object.keys(allowedFields) },
        });
        
        return NextResponse.json({ flag: updated, message: 'Feature flag mis à jour' })
      }

      return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })
  } catch (error) {
    logger.error('Error updating feature flag:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}, 'feature-flags:write');

// ─── DELETE: Delete feature flag ───────────────────────────────────

export const DELETE = withAdminAuth(async (req: NextRequest, context) => {
  try {
      const body = await req.json()
      const { flagId } = body

      if (!flagId) {
        return NextResponse.json({ error: 'flagId requis' }, { status: 400 })
      }

      const flag = await db.featureFlag.findUnique({ where: { id: flagId } });
      if (!flag) {
        return NextResponse.json({ error: 'Feature flag non trouvé' }, { status: 404 })
      }

      await db.featureFlag.delete({ where: { id: flagId } })
      
      await logAdminAction({
        action: 'delete',
        entityType: 'feature_flag',
        entityId: flagId,
        entityTitle: flag.key,
        actorEmail: context?.adminEmail || 'system',
        details: { name: flag.name },
      });
      
      return NextResponse.json({ message: 'Feature flag supprimé' })
  } catch (error) {
    logger.error('Error deleting feature flag:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}, 'feature-flags:write');
