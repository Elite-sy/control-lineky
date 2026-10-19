'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Users, Loader2, Search, UserCheck, UserX, Building2, ShieldCheck, Trash2, Ban, ChevronRight } from 'lucide-react';
import { useTranslations } from '@/i18n/client';
import { KPICard } from './kpi-card';
import { currentLocale } from '@/i18n/format';

interface UserMembership {
  role: string;
  joinedAt: string;
  workspace: {
    id: string; name: string; slug: string; plan: string; isActive: boolean;
  };
}

interface PlatformUser {
  id: string;
  authUserId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  memberships: UserMembership[];
}

interface UsersData {
  users: PlatformUser[];
  stats: {
    total: number;
    totalActive: number;
    totalInactive: number;
    workspaceUserCounts: Record<string, number>;
  };
}

type ConfirmAction = {
  type: string;
  user?: PlatformUser;
  userId?: string;
  workspaceId?: string;
  actionLabel?: string;
  actionDescription?: string;
};

export function UsersTab({
  usersData,
  usersLoading,
  filteredUsers,
  userSearch,
  userStatusFilter,
  onSetUserSearch,
  onSetUserStatusFilter,
  onFetchUsers,
  onHandleUserAction,
  onSetConfirmAction,
  actionLoading,
}: {
  usersData: UsersData | null;
  usersLoading: boolean;
  filteredUsers: PlatformUser[];
  userSearch: string;
  userStatusFilter: 'all' | 'active' | 'inactive';
  onSetUserSearch: (v: string) => void;
  onSetUserStatusFilter: (v: 'all' | 'active' | 'inactive') => void;
  onFetchUsers: () => void;
  onHandleUserAction: (userId: string, action: string, payload?: Record<string, unknown>) => void;
  onSetConfirmAction: (action: ConfirmAction | null) => void;
  actionLoading: string | null;
}) {
  const t = useTranslations('adminExt');

  function roleBadgeColor(role: string) {
    const colors: Record<string, string> = {
      admin: 'bg-amber-accent/20 text-amber-accent border-amber-accent/30',
      manager: 'bg-blue-bright/20 text-blue-bright border-blue-bright/30',
      member: 'bg-emerald-accent/20 text-emerald-accent border-emerald-accent/30',
      user: 'bg-muted text-foreground border-gray-500/30',
    }
    return colors[role] || colors.user
  }

  function roleLabel(role: string) {
    const labels: Record<string, string> = { admin: t('usrRoleAdmin'), manager: t('usrRoleManager'), member: t('usrRoleMember'), user: t('usrRoleMember') }
    return labels[role] || role
  }

  return (
    <div className="space-y-4 mt-4">
      {usersLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-bright" />
        </div>
      ) : usersData ? (
        <>
          {/* User Stats */}
          <div className="grid grid-cols-3 gap-4">
            <KPICard icon={<Users size={18} className="text-blue-bright" />} label={t('usrKpiTotal')} value={usersData.stats.total} />
            <KPICard icon={<UserCheck size={18} className="text-emerald-accent" />} label={t('usrKpiActive')} value={usersData.stats.totalActive} />
            <KPICard icon={<UserX size={18} className="text-red-400" />} label={t('usrKpiInactive')} value={usersData.stats.totalInactive} />
          </div>

          {/* Search & Filter Bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('usrSearchPlaceholder')}
                value={userSearch}
                onChange={(e) => onSetUserSearch(e.target.value)}
                className="pl-9 h-9 bg-secondary border-border/30 text-foreground placeholder:text-muted-foreground/60"
              />
            </div>
            <Select value={userStatusFilter} onValueChange={(v) => onSetUserStatusFilter(v as 'all' | 'active' | 'inactive')}>
              <SelectTrigger className="w-36 h-9 bg-secondary border-border/30 text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border/30">
                <SelectItem value="all">{t('usrFilterAll')}</SelectItem>
                <SelectItem value="active">{t('usrFilterActive')}</SelectItem>
                <SelectItem value="inactive">{t('usrFilterInactive')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 border-border/30 text-muted-foreground hover:bg-secondary"
              onClick={onFetchUsers}>
              <Loader2 size={14} className={usersLoading ? 'animate-spin mr-1.5' : 'mr-1.5 hidden'} />
              {t('usrRefresh')}
            </Button>
          </div>

          {/* Users List */}
          <div className="space-y-2">
            {filteredUsers.map((u) => (
              <Card key={u.id} className="bg-muted border-border/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold ${
                      u.isActive
                        ? 'bg-blue-bright/20 text-blue-bright'
                        : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                    }`}>
                      {(u.fullName || u.email).charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">
                          {u.fullName || u.email.split('@')[0]}
                        </span>
                        {!u.isActive && (
                          <Badge className="text-[10px] bg-red-500/20 text-red-300 border-red-500/30">{t('usrBadgeInactive')}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>

                      {/* Workspaces & Roles */}
                      {u.memberships.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {u.memberships.map((m, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary flex items-center gap-1">
                              <Building2 size={9} className="text-muted-foreground" />
                              <span className="text-muted-foreground">{m.workspace.name}</span>
                              <Badge className={`text-[9px] px-1 py-0 ${roleBadgeColor(m.role)}`}>
                                {roleLabel(m.role)}
                              </Badge>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-[10px] text-muted-foreground">
                        {t('usrRegisteredOn', { date: new Date(u.createdAt).toLocaleDateString(currentLocale()) })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {t('usrWorkspacesCount', { count: u.memberships.length })}
                      </p>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0"
                          disabled={actionLoading === `user-${u.id}`}>
                          {actionLoading === `user-${u.id}` ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <ChevronRight size={14} className="text-muted-foreground" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border/30 w-52">
                        <DropdownMenuLabel className="text-foreground text-xs">
                          {t('usrActionsFor', { name: u.email.split('@')[0] ?? '' })}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-border" />

                        {u.isActive ? (
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                            onClick={() => onSetConfirmAction({
                              type: 'toggle-user-active',
                              user: u,
                              userId: u.id,
                              actionLabel: t('usrDisableLabel', { email: u.email }),
                              actionDescription: t('usrDisableDesc'),
                            })}>
                            <Ban size={14} className="mr-2" />
                            {t('usrDisableAccount')}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="text-emerald-accent focus:text-emerald-300 focus:bg-emerald-accent/10 cursor-pointer"
                            onClick={() => onSetConfirmAction({
                              type: 'toggle-user-active',
                              user: u,
                              userId: u.id,
                              actionLabel: t('usrReactivateLabel', { email: u.email }),
                              actionDescription: t('usrReactivateDesc'),
                            })}>
                            <UserCheck size={14} className="mr-2" />
                            {t('usrReactivateAccount')}
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator className="bg-border" />

                        {/* Change role in each workspace */}
                        {u.memberships.map((m) => (
                          <div key={m.workspace.id}>
                            <DropdownMenuLabel className="text-[10px] text-muted-foreground px-2 py-1">
                              {t('usrWorkspace', { name: m.workspace.name })}
                            </DropdownMenuLabel>
                            {['admin', 'manager', 'member'].filter(r => r !== m.role).map(r => (
                              <DropdownMenuItem
                                key={r}
                                className="text-foreground cursor-pointer"
                                onClick={() => onHandleUserAction(u.id, 'change-role', {
                                  workspaceId: m.workspace.id,
                                  role: r,
                                })}>
                                <ShieldCheck size={14} className="mr-2" />
                                {t('usrRoleArrow', { role: roleLabel(r) })}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuItem
                              className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                              onClick={() => onSetConfirmAction({
                                type: 'remove-from-workspace',
                                user: u,
                                userId: u.id,
                                workspaceId: m.workspace.id,
                                actionLabel: t('usrRemoveLabel', { email: u.email, ws: m.workspace.name }),
                                actionDescription: t('usrRemoveDesc'),
                              })}>
                              <Trash2 size={14} className="mr-2" />
                              {t('usrRemoveFromWorkspace')}
                            </DropdownMenuItem>
                          </div>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {userSearch || userStatusFilter !== 'all'
                    ? t('usrNoUserFiltered')
                    : t('usrNoUser')}
                </p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
