/**
 * GET /api/admin/overview
 *
 * Dashboard plateforme — statistiques globales.
 * Réservé aux administrateurs plateforme.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { db } from '@lineky/database'
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic'

export const GET = withAdminAuth(async (_req: NextRequest) => {
  try {
      const [
        totalWorkspaces,
        totalUsers,
        totalContacts,
        totalDeals,
        totalCompanies,
        totalTasks,
        totalTickets,
      ] = await Promise.all([
        db.workspace.count(),
        db.user.count(),
        db.contact.count(),
        db.deal.count(),
        db.company.count(),
        db.task.count(),
        db.ticket.count(),
      ])

      // Répartition par plan
      const planDistribution = await db.workspace.groupBy({
        by: ['plan'],
        _count: { id: true },
      })

      // Souscriptions actives
      const activeSubscriptions = await db.subscription.findMany({
        where: { status: { in: ['active', 'trialing'] } },
        include: {
          workspace: { select: { name: true, slug: true } },
          plan: { select: { displayName: true, price: true } },
        },
        orderBy: { currentPeriodStart: 'desc' },
      })

      const mrr = activeSubscriptions.reduce((sum, sub) => sum + (sub.plan?.price ?? 0), 0)

      // Workspaces récents (7 jours)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const recentWorkspaces = await db.workspace.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, name: true, slug: true, plan: true, createdAt: true, _count: { select: { members: true } } },
      })

      // Tous les workspaces (pour la table)
      const allWorkspaces = await db.workspace.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, slug: true, plan: true, isActive: true, createdAt: true,
          subscription: { select: { status: true, currentPeriodEnd: true, squareSubscriptionId: true } },
          members: {
            select: {
              user: { select: { email: true, fullName: true, isActive: true } },
              role: true,
              joinedAt: true,
            },
            orderBy: { joinedAt: 'asc' },
          },
          _count: { select: { members: true } },
        },
      })

      return NextResponse.json({
        stats: { totalWorkspaces, totalUsers, totalContacts, totalDeals, totalCompanies, totalTasks, totalTickets },
        planDistribution: planDistribution.map((p) => ({ plan: p.plan, count: p._count.id })),
        billing: { activeSubscriptions: activeSubscriptions.length, mrr, currency: 'EUR' },
        recentWorkspaces,
        allWorkspaces,
      })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[Admin Overview] Error:', message)
    return NextResponse.json({ error: 'Erreur serveur', debug: message }, { status: 500 })
  }
}, 'analytics:read');
