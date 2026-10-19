'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertOctagon, Activity, Flame, TrendingUp, FileDown, Grid3X3, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { KPICard } from './kpi-card';
import { useTranslations } from '@/i18n/client';
import { currentLocale } from '@/i18n/format';

export interface AnalyticsData {
  churn: {
    rate30d: number;
    rate90d: number;
    churnedLast30Days: number;
    churnedLast90Days: number;
    history: { month: string; churnRate: number }[];
  };
  activation: {
    activationRate: number;
    recentlyActive: number;
    powerUserRate: number;
    powerUsers: number;
    totalUsers: number;
    activeUsers: number;
    userGrowth: { month: string; newUsers: number; cumulative: number }[];
  };
  heatmap: {
    featureStats: Record<string, { adoptionRate: number; total: number; avg: number }>;
    workspaces: {
      workspaceId: string;
      workspaceName: string;
      daysSinceCreation: number;
      adoptionScore: number;
      features: Record<string, number>;
      totalActivity: number;
      activityPerDay: number;
    }[];
  };
  report: {
    topWorkspaces: {
      name: string;
      plan: string;
      totalActivity: number;
      adoptionScore: number;
      activityPerDay: number;
    }[];
  };
}

interface AnalyticsTabProps {
  data: AnalyticsData | null;
  loading: boolean;
  onRefresh: () => void;
}

export function AnalyticsTab({ data, loading, onRefresh }: AnalyticsTabProps) {
  const t = useTranslations('adminExt');
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-blue-bright" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
    {/* Export button */}
    <div className="flex justify-end">
      <Button variant="outline" size="sm"
className="h-8 gap-2 border-border/30 text-muted-foreground hover:bg-secondary"
onClick={() => window.open('/api/admin/analytics/export-pdf', '_blank')}>
<FileDown size={14} />
{t('anExportReport')}
      </Button>
    </div>

    {/* KPIs Row */}
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <KPICard icon={<AlertOctagon size={18} className={data.churn.rate30d > 5 ? 'text-red-400' : 'text-emerald-accent'} />} label={t('anKpiChurn30')} value={`${data.churn.rate30d}%`} subtitle={t('anChurn30Subtitle', { count: data.churn.churnedLast30Days })} />
      <KPICard icon={<AlertOctagon size={18} className="text-amber-accent" />} label={t('anKpiChurn90')} value={`${data.churn.rate90d}%`} subtitle={t('anChurn90Subtitle', { count: data.churn.churnedLast90Days })} />
      <KPICard icon={<Activity size={18} className="text-cyan-accent" />} label={t('anKpiActivation')} value={`${data.activation.activationRate}%`} subtitle={t('anActivationSubtitle', { count: data.activation.recentlyActive })} />
      <KPICard icon={<Flame size={18} className="text-orange-400" />} label={t('anKpiPowerUsers')} value={`${data.activation.powerUserRate}%`} subtitle={t('anPowerUsersSubtitle', { count: data.activation.powerUsers })} />
      <KPICard icon={<TrendingUp size={18} className="text-emerald-accent" />} label={t('anKpiTotalUsers')} value={data.activation.totalUsers} subtitle={t('anTotalUsersSubtitle', { count: data.activation.activeUsers })} />
    </div>

    {/* Charts Row: Churn + User Growth */}
    <div className="grid md:grid-cols-2 gap-4">
      {/* Churn History */}
      <Card className="bg-muted border-border/30">
<CardHeader className="pb-2">
  <CardTitle className="text-sm font-medium text-muted-foreground">{t('anChurnRateTitle')}</CardTitle>
</CardHeader>
<CardContent>
  {data.churn.history.length > 0 ? (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data.churn.history}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} unit="%" />
        <Tooltip contentStyle={{ backgroundColor: '#1a1f3a', border: '1px solid #2a3158', borderRadius: '8px', color: '#e2e8f0' }} formatter={(v: number) => [`${v}%`, t('anTooltipChurn')]} />
        <Line type="monotone" dataKey="churnRate" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  ) : (
    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">{t('anNoData')}</div>
  )}
</CardContent>
      </Card>

      {/* User Growth */}
      <Card className="bg-muted border-border/30">
<CardHeader className="pb-2">
  <CardTitle className="text-sm font-medium text-muted-foreground">{t('anUserGrowthTitle')}</CardTitle>
</CardHeader>
<CardContent>
  {data.activation.userGrowth.length > 0 ? (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data.activation.userGrowth}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
        <Tooltip contentStyle={{ backgroundColor: '#1a1f3a', border: '1px solid #2a3158', borderRadius: '8px', color: '#e2e8f0' }} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
        <Bar dataKey="newUsers" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('anLegendNewUsers')} />
        <Bar dataKey="cumulative" fill="#06b6d4" radius={[4, 4, 0, 0]} name={t('anLegendCumulative')} />
      </BarChart>
    </ResponsiveContainer>
  ) : (
    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">{t('anNoData')}</div>
  )}
</CardContent>
      </Card>
    </div>

    {/* Feature Adoption */}
    <Card className="bg-muted border-border/30">
      <CardHeader className="pb-3">
<CardTitle className="text-sm font-medium text-muted-foreground">{t('anFeatureAdoptionTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
{data.heatmap.featureStats ? (
  <div className="space-y-2">
    {Object.entries(data.heatmap.featureStats).map(([key, stat]: [string, { adoptionRate: number; total: number; avg: number }]) => {
      const labels: Record<string, string> = { contacts: t('anFeatureContacts'), companies: t('anFeatureCompanies'), deals: t('anFeatureDeals'), tasks: t('anFeatureTasks'), tickets: t('anFeatureTickets'), invoices: t('anFeatureInvoices'), products: t('anFeatureProducts'), emails: t('anFeatureEmails'), calls: t('anFeatureCalls'), conversations: t('anFeatureConversations') }
      return (
        <div key={key} className="flex items-center gap-3">
          <span className="text-xs text-foreground w-28 shrink-0">{labels[key] || key}</span>
          <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${stat.adoptionRate > 60 ? 'bg-emerald-500' : stat.adoptionRate > 30 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(stat.adoptionRate, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground w-12 text-right">{stat.adoptionRate}%</span>
          <span className="text-[10px] text-muted-foreground w-16 text-right">{stat.total.toLocaleString(currentLocale())}</span>
          <span className="text-[10px] text-muted-foreground w-10 text-right">{t('anPerWs', { count: stat.avg })}</span>
        </div>
      );
    })}
  </div>
) : (
  <p className="text-xs text-muted-foreground text-center py-4">{t('anNoData')}</p>
)}
      </CardContent>
    </Card>

    {/* Heatmap: Workspaces */}
    <Card className="bg-muted border-border/30">
      <CardHeader className="pb-3">
<div className="flex items-center justify-between">
  <CardTitle className="text-sm font-medium flex items-center gap-2">
    <Grid3X3 size={14} className="text-cyan-accent" />
    {t('anHeatmapTitle')}
  </CardTitle>
  <Button variant="outline" size="sm" className="h-7 text-xs border-border/30 text-muted-foreground hover:bg-secondary" onClick={onRefresh}>
    {t('anRefresh')}
  </Button>
</div>
      </CardHeader>
      <CardContent>
{data.heatmap.workspaces.length > 0 ? (
  <div className="space-y-2">
    {data.heatmap.workspaces.map((ws: AnalyticsData['heatmap']['workspaces'][number]) => {
      const featureLabels: Record<string, string> = { contacts: 'C', companies: 'E', deals: 'D', tasks: 'T', tickets: 'S', invoices: 'F', products: 'P', emails: 'M', calls: 'A', conversations: 'Co' }
      const featureKeys = Object.keys(featureLabels)
      return (
        <div key={ws.workspaceId} className="flex items-center gap-2 p-2 rounded-lg bg-muted">
          <div className="w-28 shrink-0">
            <p className="text-xs font-medium text-foreground truncate">{ws.workspaceName}</p>
            <p className="text-[10px] text-muted-foreground">{t('anDaysScore', { days: ws.daysSinceCreation, score: ws.adoptionScore })}</p>
          </div>
          {/* Feature cells */}
          <div className="flex gap-0.5 flex-1 flex-wrap">
            {featureKeys.map(fk => {
              const count = ws.features[fk] || 0
              const intensity = count === 0 ? 0 : count < 5 ? 1 : count < 20 ? 2 : count < 50 ? 3 : 4
              const bgColors = ['bg-background', 'bg-blue-900/50', 'bg-blue-700/60', 'bg-blue-500/70', 'bg-blue-bright/80']
              return (
                <div key={fk} className={`w-5 h-5 rounded ${bgColors[intensity]} flex items-center justify-center`} title={`${fk}: ${count}`}>
                  <span className="text-[7px] text-foreground/70">{featureLabels[fk]}</span>
                </div>
              )
            })}
          </div>
          <div className="text-right shrink-0 w-16">
            <p className="text-[10px] text-muted-foreground">{t('anWorkspaceTotal', { count: ws.totalActivity })}</p>
            <p className="text-[10px] text-muted-foreground">{t('anActivityPerDay', { count: ws.activityPerDay })}</p>
          </div>
        </div>
      );
    })}
  </div>
) : (
  <p className="text-xs text-muted-foreground text-center py-4">{t('anNoWorkspace')}</p>
)}
{/* Legend */}
<div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-border/20">
  <span className="text-[10px] text-muted-foreground">{t('anIntensity')}</span>
  {[0, 1, 2, 3, 4].map(i => (
    <div key={i} className="flex items-center gap-1">
      <div className={`w-3 h-3 rounded ${['bg-background', 'bg-blue-900/50', 'bg-blue-700/60', 'bg-blue-500/70', 'bg-blue-bright/80'][i]}`} />
      <span className="text-[9px] text-muted-foreground">{i === 0 ? t('anIntensity0') : i === 1 ? t('anIntensity1') : i === 2 ? t('anIntensity2') : i === 3 ? t('anIntensity3') : t('anIntensity4')}</span>
    </div>
  ))}
</div>
      </CardContent>
    </Card>

    {/* Top Workspaces */}
    {data.report.topWorkspaces.length > 0 && (
      <Card className="bg-muted border-border/30">
<CardHeader className="pb-3">
  <CardTitle className="text-sm font-medium text-muted-foreground">{t('anTopWorkspacesTitle')}</CardTitle>
</CardHeader>
<CardContent>
  <div className="space-y-2">
    {data.report.topWorkspaces.map((ws: AnalyticsData['report']['topWorkspaces'][number], i: number) => (
      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted">
        <span className="text-lg font-bold text-blue-bright/30 w-6 text-center">{i + 1}</span>
        <span className="text-sm text-foreground flex-1">{ws.name}</span>
        <Badge className={`text-[10px] ${ws.plan === 'pro' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 border-cyan-500/30' : ws.plan === 'enterprise' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/30' : 'bg-muted text-foreground border-gray-500/30'}`}>{ws.plan}</Badge>
        <span className="text-xs text-muted-foreground">{t('anActionsCount', { count: ws.totalActivity })}</span>
        <span className="text-xs text-emerald-accent">{t('anAdoptionPercent', { count: ws.adoptionScore })}</span>
        <span className="text-[10px] text-muted-foreground">{t('anActivityPerDay', { count: ws.activityPerDay })}</span>
      </div>
    ))}
  </div>
</CardContent>
      </Card>
    )}
    </>
  );
}
