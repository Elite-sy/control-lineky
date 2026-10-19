/**
 * GET /api/admin/workspaces
 *
 * Liste tous les workspaces avec détails.
 * Réservé aux administrateurs plateforme.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { db } from '@lineky/database'
import { logger } from '@/lib/logger';
import { logAdminAction } from '@lineky/platform-auth/audit/admin';

export const dynamic = 'force-dynamic'

export const GET = withAdminAuth(async (_req: NextRequest) => {
  try {
      const workspaces = await db.workspace.findMany({
        include: {
          subscription: {
            select: {
              status: true,
              currentPeriodStart: true,
              currentPeriodEnd: true,
              cancelAtPeriodEnd: true,
              squareSubscriptionId: true,
              plan: { select: { name: true, displayName: true, price: true } },
            },
          },
          members: {
            include: {
              user: { select: { email: true, fullName: true, isActive: true } },
            },
            orderBy: { joinedAt: 'asc' },
          },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json({ workspaces })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[Admin Workspaces] Error:', message)
    return NextResponse.json({ error: 'Erreur serveur', debug: message }, { status: 500 })
  }
}, 'workspaces:read');

/**
 * PATCH /api/admin/workspaces
 *
 * Actions admin sur un workspace :
 * - Changer le plan (upgrade/downgrade)
 * - Activer/désactiver un workspace
 */

export const PATCH = withAdminAuth(async (req: NextRequest, context) => {
  try {
      const body = await req.json()
      const { workspaceId, action, ...data } = body

      if (!workspaceId || !action) {
        return NextResponse.json({ error: 'workspaceId et action requis' }, { status: 400 })
      }

      // Vérifier que le workspace existe
      const ws = await db.workspace.findUnique({ where: { id: workspaceId } })
      if (!ws) {
        return NextResponse.json({ error: 'Workspace non trouvé' }, { status: 404 })
      }

      switch (action) {
        case 'change-plan': {
          const { plan } = data
          if (!plan || !['free', 'pro', 'enterprise'].includes(plan)) {
            return NextResponse.json({ error: 'Plan invalide (free, pro, enterprise)' }, { status: 400 })
          }
          const updated = await db.workspace.update({
            where: { id: workspaceId },
            data: { plan },
          })
          
          await logAdminAction({
            action: 'change_plan',
            entityType: 'workspace',
            entityId: updated.id,
            entityTitle: updated.name || updated.id,
            actorEmail: context?.adminEmail || 'system',
            workspaceId,
            details: { previousPlan: ws.plan, newPlan: plan },
          });
          
          return NextResponse.json({ success: true, workspace: updated })
        }

        case 'toggle-active': {
          const updated = await db.workspace.update({
            where: { id: workspaceId },
            data: { isActive: !ws.isActive },
          })
          
          await logAdminAction({
            action: updated.isActive ? 'activate_workspace' : 'deactivate_workspace',
            entityType: 'workspace',
            entityId: updated.id,
            entityTitle: updated.name || updated.id,
            actorEmail: context?.adminEmail || 'system',
            workspaceId,
            details: { previousState: ws.isActive, newState: updated.isActive },
          });
          
          return NextResponse.json({ success: true, workspace: updated })
        }

        default:
          return NextResponse.json({ error: `Action "${action}" non supportée` }, { status: 400 })
      }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[Admin Workspaces PATCH] Error:', message)
    return NextResponse.json({ error: 'Erreur serveur', debug: message }, { status: 500 })
  }
}, 'workspaces:write');
