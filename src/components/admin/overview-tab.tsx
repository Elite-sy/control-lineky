'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, TrendingUp, Contact, CheckSquare, Ticket, Receipt, Crown, ChevronRight } from 'lucide-react';
import { KPICard } from './kpi-card';
import { useTranslations } from '@/i18n/client';

interface PlanDist { plan: string; count: number }
interface RecentWorkspace {
  id: string; name: string; slug: string; plan: string;
  createdAt: string; _count: { members: number };
}

export interface OverviewTabProps {
  data: {
    stats: {
      totalWorkspaces: number; totalUsers: number; totalContacts: number;
      totalDeals: number; totalCompanies: number; totalTasks: number; totalTickets: number;
    };
    planDistribution: PlanDist[];
    billing: { activeSubscriptions: number; mrr: number; currency: string };
    recentWorkspaces: RecentWorkspace[];
  };
  onNavigateToWorkspaces: () => void;
}

function planBadgeColor(plan: string) {
  const colors: Record<string, string> = {
    free: 'bg-muted text-foreground border-gray-500/30',
    pro: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 border-cyan-500/30',
    enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/30',
  }
  return colors[plan] || colors.free
}

export function OverviewTab({ data, onNavigateToWorkspaces }: OverviewTabProps) {
  const t = useTranslations('adminExt');
  function planLabel(plan: string) {
    const labels: Record<string, string> = { free: t('ovPlanFree'), pro: t('ovPlanPro'), enterprise: t('ovPlanEnterprise') }
    return labels[plan] || plan
  }
  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={<Building2 size={18} className="text-cyan-accent" />} label={t('ovKpiWorkspaces')} value={data.stats.totalWorkspaces} />
        <KPICard icon={<Users size={18} className="text-blue-bright" />} label={t('ovKpiUsers')} value={data.stats.totalUsers} />
        <KPICard icon={<Contact size={18} className="text-emerald-accent" />} label={t('ovKpiContacts')} value={data.stats.totalContacts} />
        <KPICard icon={<TrendingUp size={18} className="text-amber-accent" />} label={t('ovKpiDeals')} value={data.stats.totalDeals} />
        <KPICard icon={<Receipt size={18} className="text-purple-400" />} label={t('ovKpiInvoices')} value={"—"} />
        <KPICard icon={<CheckSquare size={18} className="text-violet-400" />} label={t('ovKpiTasks')} value={data.stats.totalTasks} />
        <KPICard icon={<Ticket size={18} className="text-rose-accent" />} label={t('ovKpiTickets')} value={data.stats.totalTickets} />
        <KPICard
          icon={<Crown size={18} className="text-yellow-400" />}
          label={t('ovKpiMrr')}
          value={`${data.billing.mrr} €`}
          subtitle={t('ovMrrSubtitle', { count: data.billing.activeSubscriptions })}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-muted border-border/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('ovPlanDistributionTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.planDistribution.map((p) => {
              const total = data.planDistribution.reduce((s, x) => s + x.count, 0)
              const pct = total > 0 ? Math.round((p.count / total) * 100) : 0
              return (
                <div key={p.plan} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{planLabel(p.plan)}</span>
                    <span className="text-muted-foreground">{p.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-background rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.plan === 'pro' ? 'bg-cyan-accent' : p.plan === 'enterprise' ? 'bg-purple-500' : 'bg-gray-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="bg-muted border-border/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('ovRecentWorkspacesTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentWorkspaces.length > 0 ? (
              <div className="space-y-2">
                {data.recentWorkspaces.map((ws) => (
                  <div key={ws.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary cursor-pointer transition-colors"
                    onClick={onNavigateToWorkspaces}>
                    <Building2 size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground flex-1 truncate">{ws.name}</span>
                    <Badge className={`text-[10px] ${planBadgeColor(ws.plan)}`}>{planLabel(ws.plan)}</Badge>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('ovNoRecentWorkspaces')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
