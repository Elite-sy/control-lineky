/**
 * GET /api/admin/billing
 *
 * Dashboard facturation plateforme — MRR, ARR, évolutions, alertes, trials.
 * Réservé aux administrateurs plateforme.
 *
 * PATCH /api/admin/billing
 *
 * Actions facturation admin :
 * - extend-trial : étendre une période d'essai
 * - cancel-trial : annuler un trial (passer au plan payant immédiatement)
 * - grant-trial : accorder un trial à un workspace sans subscription active
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { db } from '@lineky/database'
import { logger } from '@/lib/logger';
import { logAdminAction } from '@lineky/platform-auth/audit/admin';

export const dynamic = 'force-dynamic'

// ─── GET: Billing Analytics ──────────────────────────────────────────

export const GET = withAdminAuth(async (_req: NextRequest) => {
  try {
      // ── 1. Toutes les subscriptions avec workspace + plan ──
      const allSubscriptions = await db.subscription.findMany({
        select: {
          id: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          trialStart: true,
          trialEnd: true,
          lastBilledAt: true,
          nextBillingDate: true,
          squareSubscriptionId: true,
          createdAt: true,
          workspace: {
            select: { id: true, name: true, slug: true, isActive: true },
          },
          plan: {
            select: { name: true, displayName: true, price: true, yearlyPrice: true, interval: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      // ── 2. MRR / ARR ──
      const activeSubs = allSubscriptions.filter(s =>
        ['active', 'trialing'].includes(s.status)
      )
      const mrr = activeSubs.reduce((sum, s) => {
        return sum + (s.plan?.interval === 'year' ? (s.plan?.yearlyPrice ?? s.plan?.price ?? 0) / 12 : (s.plan?.price ?? 0))
      }, 0)
      const arr = mrr * 12

      // ── 3. Évolution MRR sur 6 mois ──
      const mrrHistory = await buildMrrHistory()

      // ── 4. Répartition par statut ──
      const statusDistribution: Record<string, number> = {}
      allSubscriptions.forEach(s => {
        statusDistribution[s.status] = (statusDistribution[s.status] || 0) + 1
      })

      // ── 5. Répartition revenus par plan ──
      const revenueByPlan: Record<string, number> = {}
      activeSubs.forEach(s => {
        const planName = s.plan?.name || 'unknown'
        const monthly = s.plan?.interval === 'year'
          ? (s.plan?.yearlyPrice ?? s.plan?.price ?? 0) / 12
          : (s.plan?.price ?? 0)
        revenueByPlan[planName] = (revenueByPlan[planName] || 0) + monthly
      })

      // ── 6. Alertes ──
      const now = new Date()
      // `message` is kept for wire compatibility only: the admin UI renders each alert
      // from `type` + `days` through ICU keys so every locale gets its own wording.
      const alerts: Array<{
        type: string;
        severity: 'warning' | 'critical';
        workspaceId: string;
        workspaceName: string;
        message: string;
        days?: number;
        date?: string;
      }> = []

      // Subscriptions expirant dans 7 jours
      allSubscriptions.forEach(s => {
        if (s.currentPeriodEnd && ['active', 'trialing'].includes(s.status)) {
          const daysUntilExpiry = Math.ceil(
            (s.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          )
          if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
            alerts.push({
              type: 'expiring',
              severity: daysUntilExpiry <= 3 ? 'critical' : 'warning',
              workspaceId: s.workspace.id,
              workspaceName: s.workspace.name,
              message: `Expire dans ${daysUntilExpiry} jour(s)`,
              days: daysUntilExpiry,
              date: s.currentPeriodEnd.toISOString(),
            })
          }
        }
      })

      // Subscriptions en past_due
      allSubscriptions.filter(s => s.status === 'past_due').forEach(s => {
        alerts.push({
          type: 'past_due',
          severity: 'critical',
          workspaceId: s.workspace.id,
          workspaceName: s.workspace.name,
          message: 'Paiement en retard — facture impayée',
        })
      })

      // Trials expirant bientôt
      allSubscriptions.filter(s => s.trialEnd && s.status === 'trialing').forEach(s => {
        const trialEndDate = new Date(String(s.trialEnd))
        const daysLeft = Math.ceil(
          (trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysLeft <= 3 && daysLeft > 0) {
          alerts.push({
            type: 'trial_expiring',
            severity: 'warning',
            workspaceId: s.workspace.id,
            workspaceName: s.workspace.name,
            message: `Trial expire dans ${daysLeft} jour(s)`,
            days: daysLeft,
            date: s.trialEnd ? s.trialEnd as unknown as string : undefined,
          })
        }
      })

      // Subscriptions annulées (cancelAtPeriodEnd)
      allSubscriptions.filter(s => s.cancelAtPeriodEnd && s.status === 'active').forEach(s => {
        alerts.push({
          type: 'cancellation_pending',
          severity: 'warning',
          workspaceId: s.workspace.id,
          workspaceName: s.workspace.name,
          message: 'Annulation en fin de période',
          date: s.currentPeriodEnd?.toISOString(),
        })
      })

      // ── 7. Trials ──
      const trials = allSubscriptions
        .filter(s => s.trialStart || s.status === 'trialing')
        .map(s => {
          const trialEnd = s.trialEnd ? new Date(s.trialEnd) : null
          const nowMs = now.getTime()
          let trialStatus: 'active' | 'expired' | 'converted' = 'active'
          if (trialEnd && trialEnd.getTime() < nowMs) {
            trialStatus = s.status === 'trialing' ? 'expired' : 'converted'
          }
          const daysLeft = trialEnd
            ? Math.max(0, Math.ceil((trialEnd.getTime() - nowMs) / (1000 * 60 * 60 * 24)))
            : null

          return {
            id: s.id,
            workspaceId: s.workspace.id,
            workspaceName: s.workspace.name,
            workspaceSlug: s.workspace.slug,
            planName: s.plan?.displayName || s.plan?.name || '-',
            status: s.status,
            trialStatus,
            trialStart: s.trialStart,
            trialEnd: s.trialEnd,
            daysLeft,
            squareSubscriptionId: s.squareSubscriptionId,
          }
        })

      // ── 8. Workspaces sans subscription (plan "free" uniquement) ──
      const subscribedWorkspaceIds = new Set(allSubscriptions.map(s => s.workspace.id))
      const freeWorkspaces = await db.workspace.findMany({
        where: {
          id: { notIn: [...subscribedWorkspaceIds] },
          plan: 'free',
        },
        select: { id: true, name: true, slug: true, createdAt: true, _count: { select: { members: true } } },
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json({
        // KPIs
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(arr * 100) / 100,
        currency: 'EUR',
        activeSubscriptions: activeSubs.length,
        totalSubscriptions: allSubscriptions.length,

        // History
        mrrHistory,

        // Distributions
        statusDistribution,
        revenueByPlan,

        // Toutes les subscriptions
        subscriptions: allSubscriptions,

        // Alertes
        alerts: alerts.sort((a, b) => {
          if (a.severity === 'critical' && b.severity !== 'critical') return -1
          if (a.severity !== 'critical' && b.severity === 'critical') return 1
          return 0
        }),

        // Trials
        trials,

        // Workspaces gratuits (sans subscription)
        freeWorkspaces,
      })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[Admin Billing] Error:', message)
    return NextResponse.json({ error: 'Erreur serveur', debug: message }, { status: 500 })
  }
}, 'billing:read');

// ─── PATCH: Trial Management ─────────────────────────────────────────

export const PATCH = withAdminAuth(async (req: NextRequest, context) => {
  try {
      const body = await req.json()
      const { workspaceId, action, ...data } = body

      if (!workspaceId || !action) {
        return NextResponse.json({ error: 'workspaceId et action requis' }, { status: 400 })
      }

      // Vérifier que le workspace existe
      const ws = await db.workspace.findUnique({
        where: { id: workspaceId },
        include: { subscription: true },
      })
      if (!ws) {
        return NextResponse.json({ error: 'Workspace non trouvé' }, { status: 404 })
      }

      switch (action) {
        // ── Étendre un trial existant ──
        case 'extend-trial': {
          if (!ws.subscription) {
            return NextResponse.json({ error: 'Aucune subscription pour ce workspace' }, { status: 404 })
          }
          const { days = 14 } = data as { days?: number }
          if (typeof days !== 'number' || days < 1 || days > 90) {
            return NextResponse.json({ error: 'Durée invalide (1-90 jours)' }, { status: 400 })
          }
          const currentEnd = ws.subscription.trialEnd
            ? new Date(ws.subscription.trialEnd)
            : new Date()
          const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000)

          const updated = await db.subscription.update({
            where: { id: ws.subscription.id },
            data: {
              trialEnd: newEnd,
              currentPeriodEnd: newEnd,
              status: 'trialing',
            },
          })
          
          await logAdminAction({
            action: 'extend_trial',
            entityType: 'subscription',
            entityId: updated.id,
            entityTitle: `Workspace ${ws.name || workspaceId}`,
            actorEmail: context?.adminEmail || 'system',
            workspaceId,
            details: { days, previousEnd: currentEnd, newEnd },
          });
          
          return NextResponse.json({
            success: true,
            message: `Trial étendu de ${days} jours (jusqu'au ${newEnd.toLocaleDateString('fr-FR')})`,
            subscription: updated,
          })
        }

        // ── Annuler un trial (passer directement au plan payant) ──
        case 'cancel-trial': {
          if (!ws.subscription) {
            return NextResponse.json({ error: 'Aucune subscription pour ce workspace' }, { status: 404 })
          }
          const periodEnd = new Date()
          periodEnd.setDate(periodEnd.getDate() + 30)

          const updated = await db.subscription.update({
            where: { id: ws.subscription.id },
            data: {
              trialStart: null,
              trialEnd: null,
              status: 'active',
              currentPeriodStart: new Date(),
              currentPeriodEnd: periodEnd,
            },
          })
          
          await logAdminAction({
            action: 'cancel_trial',
            entityType: 'subscription',
            entityId: updated.id,
            entityTitle: `Workspace ${ws.name || workspaceId}`,
            actorEmail: context?.adminEmail || 'system',
            workspaceId,
            details: { previousStatus: 'trialing', newStatus: 'active' },
          });
          
          return NextResponse.json({
            success: true,
            message: 'Trial annulé — passage au plan payant actif',
            subscription: updated,
          })
        }

        // ── Accorder un trial à un workspace sans subscription ──
        case 'grant-trial': {
          if (ws.subscription) {
            return NextResponse.json({ error: 'Ce workspace a déjà une subscription — utiliser extend-trial' }, { status: 400 })
          }
          const { days = 14, planName = 'pro' } = data as { days?: number; planName?: string }

          // Trouver le plan cible
          const targetPlan = await db.plan.findUnique({ where: { name: planName } })
          if (!targetPlan) {
            return NextResponse.json({ error: `Plan "${planName}" non trouvé` }, { status: 404 })
          }

          const now = new Date()
          const trialEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

          const subscription = await db.subscription.create({
            data: {
              workspaceId,
              planId: targetPlan.id,
              status: 'trialing',
              trialStart: now,
              trialEnd,
              currentPeriodStart: now,
              currentPeriodEnd: trialEnd,
            },
          })
          
          await logAdminAction({
            action: 'grant_trial',
            entityType: 'subscription',
            entityId: subscription.id,
            entityTitle: `Workspace ${ws.name || workspaceId}`,
            actorEmail: context?.adminEmail || 'system',
            workspaceId,
            details: { days, planName: targetPlan.displayName, trialEnd },
          });
          
          return NextResponse.json({
            success: true,
            message: `Trial de ${days} jours accordé sur le plan ${targetPlan.displayName} (jusqu'au ${trialEnd.toLocaleDateString('fr-FR')})`,
            subscription,
          })
        }

        // ── Annuler la résiliation (réactiver) ──
        case 'reactivate': {
          if (!ws.subscription) {
            return NextResponse.json({ error: 'Aucune subscription pour ce workspace' }, { status: 404 })
          }
          const updated = await db.subscription.update({
            where: { id: ws.subscription.id },
            data: {
              cancelAtPeriodEnd: false,
              status: 'active',
            },
          })
          
          await logAdminAction({
            action: 'reactivate_subscription',
            entityType: 'subscription',
            entityId: updated.id,
            entityTitle: `Workspace ${ws.name || workspaceId}`,
            actorEmail: context?.adminEmail || 'system',
            workspaceId,
            details: { previousCancelAtPeriodEnd: ws.subscription.cancelAtPeriodEnd },
          });
          
          return NextResponse.json({
            success: true,
            message: 'Subscription réactivée — annulation de résiliation annulée',
            subscription: updated,
          })
        }

        default:
          return NextResponse.json({ error: `Action "${action}" non supportée` }, { status: 400 })
      }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[Admin Billing PATCH] Error:', message)
    return NextResponse.json({ error: 'Erreur serveur', debug: message }, { status: 500 })
  }
}, 'billing:write');

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Construit l'historique MRR sur les 6 derniers mois.
 * Se base sur les subscriptions actives à la fin de chaque mois.
 */
async function buildMrrHistory(): Promise<Array<{ month: string; mrr: number; count: number }>> {
  const months: Array<{ month: string; mrr: number; count: number }> = []
  const now = new Date()

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const monthLabel = monthStart.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })

    // Subscriptions actives pendant ce mois
    const subs = await db.subscription.findMany({
      where: {
        status: { in: ['active', 'trialing'] },
        currentPeriodStart: { lte: monthEnd },
        OR: [
          { currentPeriodEnd: null },
          { currentPeriodEnd: { gte: monthStart } },
        ],
      },
      select: {
        plan: { select: { price: true, yearlyPrice: true, interval: true } },
      },
    })

    const monthMrr = subs.reduce((sum, s) => {
      return sum + (s.plan?.interval === 'year'
        ? (s.plan?.yearlyPrice ?? s.plan?.price ?? 0) / 12
        : (s.plan?.price ?? 0))
    }, 0)

    months.push({
      month: monthLabel,
      mrr: Math.round(monthMrr * 100) / 100,
      count: subs.length,
    })
  }

  return months
}
