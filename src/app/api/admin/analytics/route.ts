/**
 * GET /api/admin/analytics
 *
 * Analytics avancés plateforme :
 * - Churn rate (taux de résiliation)
 * - Activation rate (utilisateurs actifs vs inscrits)
 * - Heatmap d'utilisation par feature
 * - Données pour rapport mensuel
 * Réservé aux administrateurs plateforme.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getLocale } from 'next-intl/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { db } from '@lineky/database'
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic'

export const GET = withAdminAuth(async (_req: NextRequest) => {
  try {
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

      // Active/request locale for user-facing month labels (chart axes on
      // analytics-tab) — resolved like every other i18n surface (cookie →
      // Accept-Language → fr; see src/i18n/request.ts).
      const locale = await getLocale()

      // ═══════════════════════════════════════════════════════════
      // 1. CHURN RATE
      // ═══════════════════════════════════════════════════════════

      const totalWorkspaces = await db.workspace.count()
      const activeWorkspaces = await db.workspace.count({ where: { isActive: true } })

      // Workspaces désactivés au cours des 30 derniers jours
      // (updatedAt sert de proxy de la date de désactivation)
      const churnedLast30Days = await db.workspace.count({
        where: {
          isActive: false,
          updatedAt: { gte: thirtyDaysAgo },
        },
      })
      const churnRate30d = totalWorkspaces > 0
        ? Math.round((churnedLast30Days / totalWorkspaces) * 1000) / 10
        : 0

      // Churn sur 90 jours
      const churnedLast90Days = await db.workspace.count({
        where: {
          isActive: false,
          createdAt: { lte: ninetyDaysAgo },
        },
      })
      const churnRate90d = totalWorkspaces > 0
        ? Math.round((churnedLast90Days / totalWorkspaces) * 1000) / 10
        : 0

      // Historique churn sur 6 mois
      const churnHistory = await buildChurnHistory(locale)

      // ═══════════════════════════════════════════════════════════
      // 2. ACTIVATION RATE
      // ═══════════════════════════════════════════════════════════

      const totalUsers = await db.user.count()
      const activeUsers = await db.user.count({ where: { isActive: true } })

      // Utilisateurs avec activité récente : membres dont le workspace a des contacts/deals/tickets récents
      const recentWorkspaceIds = new Set<string>()

      const recentContacts = await db.contact.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { workspaceId: true },
        distinct: ['workspaceId'],
      })
      const recentDeals = await db.deal.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { workspaceId: true },
        distinct: ['workspaceId'],
      })
      const recentTasks = await db.task.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { workspaceId: true },
        distinct: ['workspaceId'],
      })
      const recentTickets = await db.ticket.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { workspaceId: true },
        distinct: ['workspaceId'],
      })

      ;[...recentContacts, ...recentDeals, ...recentTasks, ...recentTickets].forEach(r => { if (r.workspaceId) recentWorkspaceIds.add(r.workspaceId) })

      // Membres de ces workspaces actifs
      const activeMembers = await db.workspaceMember.findMany({
        where: { workspaceId: { in: [...recentWorkspaceIds] } },
        select: { userId: true },
        distinct: ['userId'],
      })

      // Power users : membres de workspaces avec > 10 contacts ou > 5 deals
      const wsContactCounts = await db.contact.groupBy({
        by: ['workspaceId'],
        _count: { id: true },
      })
      const wsDealCounts = await db.deal.groupBy({
        by: ['workspaceId'],
        _count: { id: true },
      })

      const powerWorkspaceIds = new Set<string>()
      wsContactCounts.filter((w: { _count: { id: number }; workspaceId: string | null }) => w._count.id > 10 && w.workspaceId).forEach((w: { _count: { id: number }; workspaceId: string | null }) => { if (w.workspaceId) powerWorkspaceIds.add(w.workspaceId) })
      wsDealCounts.filter((w: { _count: { id: number }; workspaceId: string | null }) => w._count.id > 5 && w.workspaceId).forEach((w: { _count: { id: number }; workspaceId: string | null }) => { if (w.workspaceId) powerWorkspaceIds.add(w.workspaceId) })

      const powerMembers = await db.workspaceMember.findMany({
        where: { workspaceId: { in: [...powerWorkspaceIds] } },
        select: { userId: true },
        distinct: ['userId'],
      })

      const activationRate = totalUsers > 0
        ? Math.round((activeMembers.length / totalUsers) * 1000) / 10
        : 0
      const powerUserRate = totalUsers > 0
        ? Math.round((powerMembers.length / totalUsers) * 1000) / 10
        : 0

      // Nouveaux utilisateurs par mois (6 derniers mois)
      const userGrowth = await buildUserGrowthHistory(locale)

      // ═══════════════════════════════════════════════════════════
      // 3. HEATMAP UTILISATION PAR FEATURE
      // ═══════════════════════════════════════════════════════════

      const allWorkspaces = await db.workspace.findMany({
        select: {
          id: true, name: true, slug: true, plan: true, isActive: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      // Compter les éléments par workspace pour chaque feature
      const [
        contactCounts, companyCounts, dealCounts, taskCounts,
        ticketCounts, invoiceCounts, productCounts,
      ] = await Promise.all([
        db.contact.groupBy({ by: ['workspaceId'], _count: { id: true } }),
        db.company.groupBy({ by: ['workspaceId'], _count: { id: true } }),
        db.deal.groupBy({ by: ['workspaceId'], _count: { id: true } }),
        db.task.groupBy({ by: ['workspaceId'], _count: { id: true } }),
        db.ticket.groupBy({ by: ['workspaceId'], _count: { id: true } }),
        db.invoice.groupBy({ by: ['workspaceId'], _count: { id: true } }),
        db.product.groupBy({ by: ['workspaceId'], _count: { id: true } }),
      ])

      // Mapper workspaceId -> count pour chaque feature
      const buildCountMap = (arr: Array<{ workspaceId: string | null; _count: { id: number } }>) => {
        const map: Record<string, number> = {}
        arr.forEach(a => { if (a.workspaceId) map[a.workspaceId] = a._count.id })
        return map
      }

      const countMaps = {
        contacts: buildCountMap(contactCounts),
        companies: buildCountMap(companyCounts),
        deals: buildCountMap(dealCounts),
        tasks: buildCountMap(taskCounts),
        tickets: buildCountMap(ticketCounts),
        invoices: buildCountMap(invoiceCounts),
        products: buildCountMap(productCounts),
        emails: {} as Record<string, number>,
        calls: {} as Record<string, number>,
        conversations: {} as Record<string, number>,
      }

      // Calculer le score d'adoption par workspace
      const heatmapData = allWorkspaces.map((ws: { id: string; name: string; slug: string; plan: string; isActive: boolean; createdAt: Date }) => {
        const counts: Record<string, number> = {}
        let totalActivity = 0
        let featuresUsed = 0

        Object.entries(countMaps).forEach(([feature, map]) => {
          const count = map[ws.id] || 0
          counts[feature] = count
          totalActivity += count
          if (count > 0) featuresUsed++
        })

        const maxFeatures = 10
        const adoptionScore = Math.round((featuresUsed / maxFeatures) * 100)
        const daysSinceCreation = Math.max(1, Math.floor(
          (now.getTime() - new Date(ws.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ))
        const activityPerDay = Math.round((totalActivity / daysSinceCreation) * 10) / 10

        return {
          workspaceId: ws.id,
          workspaceName: ws.name,
          workspaceSlug: ws.slug,
          plan: ws.plan,
          isActive: ws.isActive,
          createdAt: ws.createdAt,
          daysSinceCreation,
          features: counts,
          totalActivity,
          featuresUsed,
          maxFeatures,
          adoptionScore,
          activityPerDay,
        }
      })

      // Statistiques globales par feature
      const featureKeys = Object.keys(countMaps) as Array<keyof typeof countMaps>
      const wsCount = allWorkspaces.length || 1
      const featureStats: Record<string, { workspaces: number; total: number; avg: number; adoptionRate: number }> = {}

      featureKeys.forEach(key => {
        const map = countMaps[key]
        const total = Object.values(map).reduce((s, v) => s + v, 0)
        const wsCountFeature = Object.values(map).filter(v => v > 0).length
        featureStats[key] = {
          workspaces: wsCountFeature,
          total,
          avg: Math.round((total / wsCount) * 10) / 10,
          adoptionRate: Math.round((wsCountFeature / wsCount) * 1000) / 10,
        }
      })

      // ═══════════════════════════════════════════════════════════
      // 4. RÉCAPITULATIF RAPPORT
      // ═══════════════════════════════════════════════════════════

      const paidWorkspaces = allWorkspaces.filter((w: { id: string; name: string; slug: string; plan: string; isActive: boolean; createdAt: Date }) => w.plan !== 'free').length

      const report = {
        period: {
          from: thirtyDaysAgo.toISOString(),
          to: now.toISOString(),
          generatedAt: now.toISOString(),
          month: now.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
        },
        platform: {
          totalWorkspaces,
          activeWorkspaces,
          paidWorkspaces,
          freeWorkspaces: totalWorkspaces - paidWorkspaces,
          totalUsers,
          activeUsers,
          churnRate30d,
          churnRate90d,
          activationRate,
          powerUserRate,
        },
        billing: {
          activeSubscriptions: await db.subscription.count({ where: { status: { in: ['active', 'trialing'] } } }),
          trialSubscriptions: await db.subscription.count({ where: { status: 'trialing' } }),
          cancelledSubscriptions: await db.subscription.count({ where: { status: 'cancelled' } }),
        },
        featureAdoption: featureKeys.map(key => ({
          feature: key,
          workspaces: featureStats[key]!.workspaces,
          total: featureStats[key]!.total,
          avg: featureStats[key]!.avg,
          adoptionRate: Math.round((featureStats[key]!.workspaces / wsCount) * 1000) / 10,
        })),
        topWorkspaces: heatmapData
          .sort((a: typeof heatmapData[0], b: typeof heatmapData[0]) => b.totalActivity - a.totalActivity)
          .slice(0, 5)
          .map((ws: typeof heatmapData[0]) => ({
            name: ws.workspaceName,
            plan: ws.plan,
            totalActivity: ws.totalActivity,
            adoptionScore: ws.adoptionScore,
            activityPerDay: ws.activityPerDay,
          })),
      }

      return NextResponse.json({
        churn: {
          rate30d: churnRate30d,
          rate90d: churnRate90d,
          churnedLast30Days,
          churnedLast90Days,
          history: churnHistory,
        },
        activation: {
          totalUsers,
          activeUsers,
          inactiveUsers: totalUsers - activeUsers,
          recentlyActive: activeMembers.length,
          powerUsers: powerMembers.length,
          activationRate,
          powerUserRate,
          userGrowth,
        },
        heatmap: {
          workspaces: heatmapData,
          featureStats,
        },
        report,
      })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[Admin Analytics] Error:', message)
    return NextResponse.json({ error: 'Erreur serveur', debug: message }, { status: 500 })
  }
}, 'analytics:read');

// ─── Helpers ─────────────────────────────────────────────────────────

async function buildChurnHistory(locale: string): Promise<Array<{ month: string; churnRate: number; churned: number; total: number }>> {
  const now = new Date()
  const months: Array<{ month: string; churnRate: number; churned: number; total: number }> = []

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const prevMonthEnd = new Date(monthStart.getTime() - 1)
    const label = monthStart.toLocaleDateString(locale, { month: 'short', year: '2-digit' })

    const totalAtStart = await db.workspace.count({
      where: { createdAt: { lte: prevMonthEnd } },
    })
    const churned = await db.workspace.count({
      where: {
        isActive: false,
        createdAt: { lte: prevMonthEnd },
      },
    })

    months.push({
      month: label,
      churnRate: totalAtStart > 0 ? Math.round((churned / totalAtStart) * 1000) / 10 : 0,
      churned,
      total: totalAtStart,
    })
  }

  return months
}

async function buildUserGrowthHistory(locale: string): Promise<Array<{ month: string; newUsers: number; cumulative: number }>> {
  const now = new Date()
  const months: Array<{ month: string; newUsers: number; cumulative: number }> = []
  let cumulative = 0

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const label = monthStart.toLocaleDateString(locale, { month: 'short', year: '2-digit' })

    const newUsers = await db.user.count({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
    })
    cumulative += newUsers

    months.push({ month: label, newUsers, cumulative })
  }

  return months
}
