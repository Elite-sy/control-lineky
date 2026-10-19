'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslations } from '@/i18n/client';
import { currentLocale } from '@/i18n/format';

interface WsMember {
  user: { email: string; fullName: string | null; isActive: boolean };
  role: string; joinedAt: string;
}

interface WorkspaceFull {
  id: string; name: string; slug: string; plan: string;
  isActive: boolean; createdAt: string;
  subscription: {
    status: string | null; currentPeriodStart: string | null;
    currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean | null;
    squareSubscriptionId: string | null;
    plan: { name: string; displayName: string; price: number } | null;
  } | null;
  members: WsMember[];
  _count: { members: number };
}

type ConfirmAction = {
  type: string;
  ws?: WorkspaceFull;
  newPlan?: string;
};

export function WorkspacesTab({
  allWorkspaces,
  actionLoading,
  onHandleWsAction,
  onSetConfirmAction,
}: {
  allWorkspaces: WorkspaceFull[];
  actionLoading: string | null;
  onHandleWsAction: (wsId: string, action: string, payload?: Record<string, unknown>) => void;
  onSetConfirmAction: (action: ConfirmAction | null) => void;
}) {
  const t = useTranslations('adminExt');

  function planLabel(plan: string) {
    const labels: Record<string, string> = { free: t('wsPlanFree'), pro: t('wsPlanPro'), enterprise: t('wsPlanEnterprise') }
    return labels[plan] || plan
  }

  function planBadgeColor(plan: string) {
    const colors: Record<string, string> = {
      free: 'bg-muted text-foreground border-gray-500/30',
      pro: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 border-cyan-500/30',
      enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/30',
    }
    return colors[plan] || colors.free
  }

  function statusBadge(status: string | null) {
    if (!status) return <Badge variant="outline" className="text-muted-foreground">{t('wsNoStatus')}</Badge>
    const active = ['active', 'trialing'].includes(status)
    return (
      <Badge className={active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}>
        {status === 'active' ? t('wsStatusActive') : status === 'trialing' ? t('wsStatusTrial') : status}
      </Badge>
    )
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-3">
        {allWorkspaces.map((ws) => (
          <Card key={ws.id} className="bg-muted border-border/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-cyan-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-medium text-foreground">{ws.name}</h3>
                    <Badge className={`text-[10px] ${planBadgeColor(ws.plan)}`}>{planLabel(ws.plan)}</Badge>
                    {!ws.isActive && <Badge className="text-[10px] bg-red-500/20 text-red-300 border-red-500/30">{t('wsBadgeInactive')}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{t('wsMembersCount', { count: ws._count.members })}</span>
                    <span>•</span>
                    <span>{t('wsCreatedOn', { date: new Date(ws.createdAt).toLocaleDateString(currentLocale()) })}</span>
                    {ws.subscription?.status && (
                      <>
                        <span>•</span>
                        {statusBadge(ws.subscription.status)}
                      </>
                    )}
                  </div>

                  {ws.members.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ws.members.slice(0, 5).map((m, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                          {t('wsMemberRole', { email: m.user.email, role: m.role })}
                        </span>
                      ))}
                      {ws.members.length > 5 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                          {t('wsOthersCount', { count: ws.members.length - 5 })}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {ws.plan !== 'pro' && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-cyan-accent hover:bg-cyan-accent/10"
                      onClick={() => onSetConfirmAction({ type: 'change-plan', ws, newPlan: 'pro' })}>
                      {t('wsBtnPro')}
                    </Button>
                  )}
                  {ws.plan !== 'enterprise' && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-purple-400 hover:bg-purple-400/10"
                      onClick={() => onSetConfirmAction({ type: 'change-plan', ws, newPlan: 'enterprise' })}>
                      {t('wsBtnEnterprise')}
                    </Button>
                  )}
                  {ws.plan !== 'free' && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:bg-secondary"
                      onClick={() => onSetConfirmAction({ type: 'change-plan', ws, newPlan: 'free' })}>
                      {t('wsBtnFree')}
                    </Button>
                  )}

                  <Separator orientation="vertical" className="h-6 bg-border mx-1" />

                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                    onClick={() => onHandleWsAction(ws.id, 'toggle-active')}
                    disabled={actionLoading === ws.id}>
                    {actionLoading === ws.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : ws.isActive ? (
                      <EyeOff size={14} className="text-muted-foreground" />
                    ) : (
                      <Eye size={14} className="text-emerald-accent" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {allWorkspaces.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{t('wsNoWorkspace')}</p>
        </div>
      )}
    </div>
  );
}
