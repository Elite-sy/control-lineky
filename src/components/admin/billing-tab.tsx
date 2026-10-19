'use client';

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, Flame, CreditCard, AlertOctagon, Zap,
  Clock, Crown, Building2, Receipt, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { KPICard } from './kpi-card';
import { useTranslations } from '@/i18n/client';
import { currentLocale } from '@/i18n/format';

interface BillingAlert {
  type?: string;
  severity: string;
  workspaceName: string;
  message: string;
  days?: number;
}

interface BillingSubscription {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  nextBillingDate: string | null;
  workspace: { id: string; name: string };
  plan: { displayName: string; price: number; interval: string };
}

interface BillingTrial {
  id: string;
  trialStatus: string;
  workspaceName: string;
  planName: string;
  daysLeft: number | null;
  trialEnd: string | null;
  workspaceId: string;
}

interface FreeWorkspace {
  id: string;
  name: string;
  _count: { members: number };
  createdAt: string;
}

export interface BillingData {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  totalSubscriptions: number;
  alerts: BillingAlert[];
  mrrHistory: { month: string; mrr: number }[];
  revenueByPlan: Record<string, number>;
  statusDistribution: Record<string, number>;
  subscriptions: BillingSubscription[];
  trials: BillingTrial[];
  freeWorkspaces: FreeWorkspace[];
}

interface ConfirmAction {
  type: string;
  billingAction?: string;
  billingWorkspaceId?: string;
  billingPayload?: { planName: string; days: number };
  actionLabel?: string;
  actionDescription?: string;
}

interface BillingTabProps {
  data: BillingData | null;
  loading: boolean;
  onRefresh: () => void;
  onSetConfirmAction: (action: ConfirmAction | null) => void;
  onBillingAction: (workspaceId: string, action: string, payload?: Record<string, unknown>) => void;
}

export function BillingTab({ data, loading, onRefresh, onSetConfirmAction, onBillingAction }: BillingTabProps) {
  const t = useTranslations('adminExt');

  // The API still sends a French `message`; the text shown comes from type + days
  // so every locale gets its own wording and plural.
  const renderAlertMessage = (alert: BillingAlert): string => {
    const days = alert.days ?? 0;
    switch (alert.type) {
      case 'expiring': return t('billAlertExpiring', { count: days });
      case 'past_due': return t('billAlertPastDue');
      case 'trial_expiring': return t('billAlertTrialExpiring', { count: days });
      case 'cancellation_pending': return t('billAlertCancellationPending');
      default: return alert.message;
    }
  };

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-bright" />
        </div>
      ) : data ? (
        <>
          {/* Billing KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={<TrendingUp size={18} className="text-emerald-accent" />} label={t('billKpiMrr')} value={`${data.mrr} €`} />
            <KPICard icon={<Flame size={18} className="text-orange-400" />} label={t('billKpiArr')} value={`${data.arr} €`} />
            <KPICard icon={<CreditCard size={18} className="text-cyan-accent" />} label={t('billKpiActiveSubs')} value={data.activeSubscriptions} subtitle={t('billActiveSubsSubtitle', { count: data.totalSubscriptions })} />
            <KPICard icon={<AlertOctagon size={18} className="text-rose-accent" />} label={t('billKpiAlerts')} value={data.alerts.length} subtitle={t('billAlertsSubtitle', { count: data.alerts.filter((a: BillingAlert) => a.severity === 'critical').length })} />
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* MRR History Chart */}
            <Card className="bg-muted border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('billMrrHistoryTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.mrrHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.mrrHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1f3a', border: '1px solid #2a3158', borderRadius: '8px', color: '#e2e8f0' }}
                        formatter={(value: number) => [`${value} €`, t('billKpiMrr')]}
                      />
                      <Bar dataKey="mrr" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">{t('billNoData')}</div>
                )}
              </CardContent>
            </Card>

            {/* Revenue by Plan + Status Distribution */}
            <div className="grid grid-rows-2 gap-4">
              <Card className="bg-muted border-border/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('billRevenueByPlanTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(data.revenueByPlan).length > 0 ? (
                    <ResponsiveContainer width="100%" height={80}>
                      <PieChart>
                        <Pie
                          data={Object.entries(data.revenueByPlan).map(([name, value]) => ({ name, value }))}
                          cx="50%" cy="50%" outerRadius={30} innerRadius={18}
                          dataKey="value"
                        >
                          {Object.entries(data.revenueByPlan).map((_, i) => (
                            <Cell key={i} fill={['#06b6d4', '#a855f7', '#6b7280', '#f59e0b'][i % 4]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1a1f3a', border: '1px solid #2a3158', borderRadius: '8px', color: '#e2e8f0' }}
                          formatter={(value: number) => [t('billPerMonth', { value }), '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">{t('billNoRevenue')}</p>
                  )}
                  <div className="flex justify-center gap-4 mt-1">
                    {Object.entries(data.revenueByPlan).map(([name, value]: [string, number]) => (
                      <span key={name} className="text-[10px] text-muted-foreground">{name}: {value} €</span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted border-border/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('billStatusTitle')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(data.statusDistribution).map(([status, count]: [string, number]) => {
                    const statusLabels: Record<string, string> = { active: t('billStatusActive'), trialing: t('billStatusTrialing'), past_due: t('billStatusPastDue'), cancelled: t('billStatusCancelled'), paused: t('billStatusPaused'), expired: t('billStatusExpired') };
                    const statusColors: Record<string, string> = { active: 'bg-emerald-500', trialing: 'bg-amber-500', past_due: 'bg-red-500', cancelled: 'bg-gray-500', paused: 'bg-yellow-500', expired: 'bg-rose-600' };
                    return (
                      <div key={status} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${statusColors[status] || 'bg-gray-500'}`} />
                        <span className="text-xs text-foreground flex-1">{statusLabels[status] || status}</span>
                        <span className="text-xs text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                  {Object.keys(data.statusDistribution).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center">{t('billNoSubscription')}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Alertes */}
          {data.alerts.length > 0 && (
            <Card className="bg-muted border-border/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap size={14} className="text-amber-accent" />
                  {t('billAlertsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.alerts.map((alert: BillingAlert, i: number) => (
                  <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                    alert.severity === 'critical' ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'
                  }`}>
                    <AlertOctagon size={12} className={alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'} />
                    <span className="text-foreground flex-1">{alert.workspaceName}</span>
                    <span className={alert.severity === 'critical' ? 'text-red-300' : 'text-amber-300'}>{renderAlertMessage(alert)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Subscriptions Table */}
          <Card className="bg-muted border-border/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('billAllSubsTitle')}</CardTitle>
                <Button variant="outline" size="sm" className="h-7 text-xs border-border/30 text-muted-foreground hover:bg-secondary" onClick={onRefresh}>
                  {t('billRefresh')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.subscriptions.length > 0 ? (
                <div className="space-y-2">
                  {data.subscriptions.map((sub: BillingSubscription) => {
                    const subStatusColors: Record<string, string> = {
                      active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30',
                      trialing: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/30',
                      past_due: 'bg-red-500/20 text-red-300 border-red-500/30',
                      cancelled: 'bg-muted text-foreground border-gray-500/30',
                      paused: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                      expired: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-500/30',
                    };
                    const subStatusLabels: Record<string, string> = {
                      active: t('billStatusActive'), trialing: t('billStatusTrialing'), past_due: t('billStatusPastDue'), cancelled: t('billStatusCancelled'), paused: t('billStatusPaused'), expired: t('billStatusExpired'),
                    };
                    return (
                      <div key={sub.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <CreditCard size={14} className="text-cyan-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{sub.workspace.name}</span>
                            <Badge className={`text-[10px] ${subStatusColors[sub.status] || subStatusColors.active}`}>
                              {subStatusLabels[sub.status] || sub.status}
                            </Badge>
                            {sub.cancelAtPeriodEnd && sub.status === 'active' && (
                              <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/30">{t('billCancellationInProgress')}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                            <span>{t('billPlanLine', { name: sub.plan.displayName, price: sub.plan.price, interval: sub.plan.interval === 'year' ? t('billYear') : t('billMonth') })}</span>
                            {sub.currentPeriodEnd && (
                              <span>• {t('billExpiresOn', { date: new Date(sub.currentPeriodEnd).toLocaleDateString(currentLocale()) })}</span>
                            )}
                            {sub.nextBillingDate && (
                              <span>• {t('billNextPayment', { date: new Date(sub.nextBillingDate).toLocaleDateString(currentLocale()) })}</span>
                            )}
                          </div>
                        </div>

                        {/* Trial actions */}
                        {sub.status === 'trialing' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-cyan-accent hover:bg-cyan-accent/10"
                              onClick={() => onSetConfirmAction({
                                type: 'extend-trial',
                                billingAction: 'extend-trial',
                                billingWorkspaceId: sub.workspace.id,
                                actionLabel: t('billExtendTrialLabel', { name: sub.workspace.name }),
                                actionDescription: t('billExtendTrialDesc'),
                              })}>
                              {t('billAdd14Days')}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-purple-400 hover:bg-purple-400/10"
                              onClick={() => onSetConfirmAction({
                                type: 'cancel-trial',
                                billingAction: 'cancel-trial',
                                billingWorkspaceId: sub.workspace.id,
                                actionLabel: t('billCancelTrialLabel', { name: sub.workspace.name }),
                                actionDescription: t('billCancelTrialDesc'),
                              })}>
                              <Zap size={12} /> {t('billEndTrial')}
                            </Button>
                          </div>
                        )}
                        {sub.cancelAtPeriodEnd && sub.status === 'active' && (
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] text-emerald-accent hover:bg-emerald-accent/10 shrink-0"
                            onClick={() => onBillingAction(sub.workspace.id, 'reactivate')}>
                            {t('billReactivate')}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('billNoSubscriptionRecorded')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trials Management */}
          <Card className="bg-muted border-border/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock size={14} className="text-amber-accent" />
                {t('billTrialsTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.trials.length > 0 ? (
                <div className="space-y-2">
                  {data.trials.map((trial: BillingTrial) => (
                    <div key={trial.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        trial.trialStatus === 'active' ? 'bg-amber-accent/20' : 'bg-muted'
                      }`}>
                        <Clock size={14} className={trial.trialStatus === 'active' ? 'text-amber-accent' : 'text-muted-foreground'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{trial.workspaceName}</span>
                          <Badge className={`text-[10px] ${
                            trial.trialStatus === 'active' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/30'
                              : trial.trialStatus === 'converted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border-red-500/30'
                          }`}>
                            {trial.trialStatus === 'active' ? t('billTrialActive') : trial.trialStatus === 'converted' ? t('billTrialConverted') : t('billTrialExpired')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          <span>{trial.planName}</span>
                          {trial.daysLeft !== null && (
                            <span>• {t('billDaysLeft', { count: trial.daysLeft })}</span>
                          )}
                          {trial.trialEnd && (
                            <span>• {t('billUntil', { date: new Date(trial.trialEnd).toLocaleDateString(currentLocale()) })}</span>
                          )}
                        </div>
                      </div>
                      {trial.trialStatus === 'active' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] text-cyan-accent hover:bg-cyan-accent/10"
                            onClick={() => onSetConfirmAction({
                              type: 'extend-trial',
                              billingAction: 'extend-trial',
                              billingWorkspaceId: trial.workspaceId,
                              actionLabel: t('billExtendTrialLabel', { name: trial.workspaceName }),
                              actionDescription: t('billExtendTrialDesc'),
                            })}>
                            {t('billAdd14j')}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] text-purple-400 hover:bg-purple-400/10"
                            onClick={() => onSetConfirmAction({
                              type: 'cancel-trial',
                              billingAction: 'cancel-trial',
                              billingWorkspaceId: trial.workspaceId,
                              actionLabel: t('billEndTrialLabel2', { name: trial.workspaceName }),
                              actionDescription: t('billEndTrialDesc2'),
                            })}>
                            <Zap size={12} /> {t('billEnd')}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">{t('billNoTrial')}</p>
              )}
            </CardContent>
          </Card>

          {/* Free Workspaces — Grant Trial */}
          {data.freeWorkspaces.length > 0 && (
            <Card className="bg-muted border-border/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Crown size={14} className="text-yellow-400" />
                  {t('billFreeWsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.freeWorkspaces.map((ws: FreeWorkspace) => (
                  <div key={ws.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Building2 size={14} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground">{ws.name}</span>
                      <p className="text-[10px] text-muted-foreground">{t('billWsMembers', { count: ws._count.members, date: new Date(ws.createdAt).toLocaleDateString(currentLocale()) })}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] text-cyan-accent hover:bg-cyan-accent/10"
                        onClick={() => onSetConfirmAction({
                          type: 'grant-trial-pro',
                          billingAction: 'grant-trial',
                          billingWorkspaceId: ws.id,
                          billingPayload: { planName: 'pro', days: 14 },
                          actionLabel: t('billGrantTrialProLabel', { name: ws.name }),
                          actionDescription: t('billGrantTrialProDesc'),
                        })}>
                        {t('billTrialPro')}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] text-purple-400 hover:bg-purple-400/10"
                        onClick={() => onSetConfirmAction({
                          type: 'grant-trial-enterprise',
                          billingAction: 'grant-trial',
                          billingWorkspaceId: ws.id,
                          billingPayload: { planName: 'enterprise', days: 14 },
                          actionLabel: t('billGrantTrialEntLabel', { name: ws.name }),
                          actionDescription: t('billGrantTrialEntDesc'),
                        })}>
                        {t('billTrialEnterprise')}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Historique paiements — placeholder Square */}
          <Card className="bg-muted border-border/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('billPaymentsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Receipt size={24} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t('billPaymentsPlaceholder')}</p>
                <p className="text-[10px] text-muted-foreground/60">{t('billSquareNote')}</p>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </>
  );
}
