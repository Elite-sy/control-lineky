/**
 * GET /api/admin/analytics/export-pdf
 *
 * Export le rapport mensuel en PDF.
 * Réservé aux administrateurs plateforme.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic'

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
      // Fetch analytics data
      const analyticsUrl = new URL(req.url)
      analyticsUrl.pathname = '/api/admin/analytics'
      const analyticsRes = await fetch(analyticsUrl.toString(), {
        headers: { cookie: req.headers.get('cookie') || '' },
      })

      if (!analyticsRes.ok) {
        return NextResponse.json({ error: 'Impossible de charger les données analytics' }, { status: 500 })
      }

      const analytics = await analyticsRes.json()
      const { report } = analytics

      // Generate HTML report
      const html = generateReportHtml(report)

      return NextResponse.json({ html }, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="rapport-${new Date().toISOString().slice(0, 10)}.html"`,
        },
      }) as unknown as NextResponse
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[Admin Analytics PDF] Error:', message)
    return NextResponse.json({ error: 'Erreur serveur', debug: message }, { status: 500 })
  }
}, 'analytics:read');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateReportHtml(r: unknown): string {
  const report = r as {
    period: { from: string; to: string; generatedAt: string; month: string }
    platform: Record<string, number>
    billing: Record<string, number>
    featureAdoption: Array<{ feature: string; workspaces: number; total: number; avg: number; adoptionRate: number }>
    topWorkspaces: Array<{ name: string; plan: string; totalActivity: number; adoptionScore: number; activityPerDay: number }>
  }

  // Escape user-controlled values (workspace names, labels) before HTML interpolation
  const esc = (v: unknown): string => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  const featureLabels: Record<string, string> = {
    contacts: 'Contacts', companies: 'Entreprises', deals: 'Deals',
    tasks: 'Tâches', tickets: 'Tickets', invoices: 'Factures',
    products: 'Produits', emails: 'Emails', calls: 'Appels', conversations: 'Conversations',
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rapport Mensuel NightCRM — ${esc(report.period.month)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }
  .container { max-width: 900px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #1e293b; }
  .header h1 { font-size: 28px; color: #60a5fa; margin-bottom: 8px; }
  .header p { color: #94a3b8; font-size: 14px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .card { background: #1e293b; border-radius: 12px; padding: 20px; text-align: center; }
  .card .value { font-size: 28px; font-weight: 700; color: #60a5fa; }
  .card .label { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  .card.warning .value { color: #f59e0b; }
  .card.success .value { color: #10b981; }
  .card.danger .value { color: #ef4444; }
  .section { margin-bottom: 32px; }
  .section h2 { font-size: 18px; color: #e2e8f0; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #334155; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 10px 12px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; background: #1e293b; }
  td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #1e293b; }
  tr:hover td { background: rgba(59,130,246,0.05); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
  .badge-pro { background: rgba(6,182,212,0.15); color: #06b6d4; }
  .badge-enterprise { background: rgba(168,85,247,0.15); color: #a855f7; }
  .badge-free { background: rgba(107,114,128,0.15); color: #9ca3af; }
  .progress-bar { height: 8px; background: #334155; border-radius: 4px; overflow: hidden; width: 100px; display: inline-block; vertical-align: middle; }
  .progress-fill { height: 100%; border-radius: 4px; }
  .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #1e293b; color: #64748b; font-size: 12px; }
  @media print { body { background: #fff; color: #1e293b; } .card { border: 1px solid #e2e8f0; } }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Rapport Mensuel NightCRM</h1>
    <p>${esc(report.period.month)} — Généré le ${new Date(report.period.generatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
  </div>

  <!-- KPIs -->
  <div class="grid">
    <div class="card">
      <div class="value">${report.platform.totalWorkspaces}</div>
      <div class="label">Workspaces</div>
    </div>
    <div class="card">
      <div class="value">${report.platform.totalUsers}</div>
      <div class="label">Utilisateurs</div>
    </div>
    <div class="card ${report.platform.churnRate30d! > 5 ? 'danger' : 'success'}">
      <div class="value">${report.platform.churnRate30d}%</div>
      <div class="label">Churn (30j)</div>
    </div>
    <div class="card success">
      <div class="value">${report.platform.activationRate}%</div>
      <div class="label">Activation</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="value">${report.billing.activeSubscriptions}</div>
      <div class="label">Abonnements actifs</div>
    </div>
    <div class="card warning">
      <div class="value">${report.billing.trialSubscriptions}</div>
      <div class="label">Trials en cours</div>
    </div>
    <div class="card danger">
      <div class="value">${report.billing.cancelledSubscriptions}</div>
      <div class="label">Résiliations</div>
    </div>
    <div class="card">
      <div class="value">${report.platform.powerUserRate}%</div>
      <div class="label">Power Users</div>
    </div>
  </div>

  <!-- Feature Adoption -->
  <div class="section">
    <h2>Adoption des fonctionnalités</h2>
    <table>
      <thead>
        <tr>
          <th>Feature</th>
          <th>Workspaces</th>
          <th>Total éléments</th>
          <th>Moyenne/WS</th>
          <th>Taux d'adoption</th>
        </tr>
      </thead>
      <tbody>
        ${report.featureAdoption.map(f => `
        <tr>
          <td>${esc(featureLabels[f.feature] || f.feature)}</td>
          <td>${f.workspaces}</td>
          <td>${f.total.toLocaleString('fr-FR')}</td>
          <td>${f.avg}</td>
          <td>
            <div class="progress-bar">
              <div class="progress-fill" style="width:${Math.min(f.adoptionRate, 100)}%;background:${f.adoptionRate > 60 ? '#10b981' : f.adoptionRate > 30 ? '#f59e0b' : '#ef4444'}"></div>
            </div>
            <span style="margin-left:8px;font-size:12px;color:#94a3b8">${f.adoptionRate}%</span>
          </td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- Top Workspaces -->
  <div class="section">
    <h2>Top Workspaces (par activité)</h2>
    <table>
      <thead>
        <tr>
          <th>Workspace</th>
          <th>Plan</th>
          <th>Activité totale</th>
          <th>Score adoption</th>
          <th>Activité/jour</th>
        </tr>
      </thead>
      <tbody>
        ${report.topWorkspaces.map(ws => `
        <tr>
          <td>${esc(ws.name)}</td>
          <td><span class="badge badge-${esc(ws.plan)}">${esc(ws.plan)}</span></td>
          <td>${ws.totalActivity.toLocaleString('fr-FR')}</td>
          <td>${ws.adoptionScore}%</td>
          <td>${ws.activityPerDay}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>NightCRM — Rapport automatique généré par la console d'administration</p>
  </div>
</div>
</body>
</html>`
}
