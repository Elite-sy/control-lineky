'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Megaphone, Flag, Ticket, ScrollText, Globe, Plus,
  ToggleLeft, ToggleRight, Trash2, Loader2,
  Clock, CheckSquare, AlertOctagon, Activity, Users, Zap,
} from 'lucide-react';
import { KPICard } from './kpi-card';
import { useTranslations } from '@/i18n/client';
import { formatDate, formatDateTime } from '@/i18n/format';

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  type: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  endsAt: string | null;
}

interface FeatureFlagItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  rollout: number;
  planOverride: boolean;
}

interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  contact: { firstName: string | null; lastName: string | null; email: string | null } | null;
  source: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityTitle: string | null;
  userId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface OperationsData {
  announcements: AnnouncementItem[];
  featureFlags: FeatureFlagItem[];
  supportTickets: {
    stats: { open: number; pending: number; closed: number; critical: number };
    total: number;
    tickets: SupportTicket[];
  };
  auditLogs: {
    stats: { today: number; thisWeek: number; uniqueUsers: number; uniqueActions: number };
    total: number;
    page: number;
    totalPages: number;
    logs: AuditLog[];
  };
}

type AnnouncementState = { title: string; body: string; type: string };
type FlagState = { key: string; name: string; description: string };

export interface OperationsTabProps {
  operationsLoading: boolean;
  operationsData: OperationsData | null;
  fetchOperations: () => void;
  opsSubTab: 'announcements' | 'feature-flags' | 'support' | 'audit' | 'email';
  setOpsSubTab: (v: 'announcements' | 'feature-flags' | 'support' | 'audit' | 'email') => void;
  showNewAnnouncement: boolean;
  setShowNewAnnouncement: (v: boolean) => void;
  newAnnouncement: AnnouncementState;
  setNewAnnouncement: (updater: AnnouncementState | ((prev: AnnouncementState) => AnnouncementState)) => void;
  showNewFlag: boolean;
  setShowNewFlag: (v: boolean) => void;
  newFlag: FlagState;
  setNewFlag: (updater: FlagState | ((prev: FlagState) => FlagState)) => void;
  actionLoading: string | null;
  handleOpsAction: (action: string, payload?: Record<string, unknown>) => void;
}

export function OperationsTab({
  operationsLoading,
  operationsData,
  fetchOperations,
  opsSubTab,
  setOpsSubTab,
  showNewAnnouncement,
  setShowNewAnnouncement,
  newAnnouncement,
  setNewAnnouncement,
  showNewFlag,
  setShowNewFlag,
  newFlag,
  setNewFlag,
  actionLoading,
  handleOpsAction,
}: OperationsTabProps) {
  const t = useTranslations('adminExt');
  return (
    <div className="space-y-4 mt-4">
  {operationsLoading ? (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-8 h-8 animate-spin text-blue-bright" />
    </div>
  ) : operationsData ? (
    <>
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-2 border-b border-border/30 pb-2">
        {[
          { key: 'announcements' as const, label: t('opsTabAnnouncements'), icon: <Megaphone size={14} /> },
          { key: 'feature-flags' as const, label: t('opsTabFeatureFlags'), icon: <Flag size={14} /> },
          { key: 'support' as const, label: t('opsTabSupport'), icon: <Ticket size={14} /> },
          { key: 'audit' as const, label: t('opsTabAudit'), icon: <ScrollText size={14} /> },
          { key: 'email' as const, label: t('opsTabEmail'), icon: <Globe size={14} /> },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              opsSubTab === tab.key
                ? 'bg-blue-bright/20 text-blue-bright'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
            onClick={() => setOpsSubTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <div className="ml-auto">
          <Button variant="outline" size="sm" className="h-7 text-xs border-border/30 text-muted-foreground hover:bg-secondary"
            onClick={fetchOperations}>
            <Loader2 size={12} className={operationsLoading ? 'animate-spin mr-1' : 'mr-1 hidden'} />
            {t('opsRefresh')}
          </Button>
        </div>
      </div>

      {/* ════ ANNOUNCEMENTS ════ */}
      {opsSubTab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-amber-accent" />
              <span className="text-sm font-medium text-foreground">{t('opsAnnouncementsTitle')}</span>
              <Badge className="text-[10px] bg-blue-bright/20 text-blue-bright border-blue-bright/30">
                {t('opsActiveCount', { count: operationsData.announcements.filter((a: AnnouncementItem) => a.isActive).length })}
              </Badge>
            </div>
            <Button size="sm" className="h-8 gap-1.5 bg-blue-glow hover:bg-blue-bright"
              onClick={() => setShowNewAnnouncement(!showNewAnnouncement)}>
              <Plus size={14} />
              {t('opsNewAnnouncement')}
            </Button>
          </div>

          {/* New announcement form */}
          {showNewAnnouncement && (
            <Card className="bg-muted border-blue-bright/20">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('opsTitleLabel')}</Label>
                    <Input
                      placeholder={t('opsTitlePlaceholder')}
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement((p: AnnouncementState) => ({ ...p, title: e.target.value }))}
                      className="h-9 bg-secondary border-border/30 text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('opsTypeLabel')}</Label>
                    <Select value={newAnnouncement.type} onValueChange={(v) => setNewAnnouncement((p: AnnouncementState) => ({ ...p, type: v }))}>
                      <SelectTrigger className="h-9 bg-secondary border-border/30 text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/30">
                        <SelectItem value="info">{t('opsTypeInfo')}</SelectItem>
                        <SelectItem value="feature">{t('opsTypeFeature')}</SelectItem>
                        <SelectItem value="warning">{t('opsTypeWarning')}</SelectItem>
                        <SelectItem value="maintenance">{t('opsTypeMaintenance')}</SelectItem>
                        <SelectItem value="critical">{t('opsTypeCritical')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('opsMessageLabel')}</Label>
                  <Textarea
                    placeholder={t('opsMessagePlaceholder')}
                    value={newAnnouncement.body}
                    onChange={(e) => setNewAnnouncement((p: AnnouncementState) => ({ ...p, body: e.target.value }))}
                    className="min-h-[80px] bg-secondary border-border/30 text-foreground resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" className="h-8 text-muted-foreground"
                    onClick={() => { setShowNewAnnouncement(false); setNewAnnouncement({ title: '', body: '', type: 'info' }); }}>
                    {t('opsCancel')}
                  </Button>
                  <Button size="sm" className="h-8 bg-blue-glow hover:bg-blue-bright"
                    disabled={!newAnnouncement.title.trim() || actionLoading === 'create-announcement'}
                    onClick={() => handleOpsAction('create-announcement', {
                      title: newAnnouncement.title,
                      body: newAnnouncement.body,
                      type: newAnnouncement.type,
                    })}>
                    {actionLoading === 'create-announcement' ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} className="mr-1" />}
                    {t('opsPublish')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Announcements list */}
          <div className="space-y-2">
            {operationsData.announcements.map((ann: AnnouncementItem) => {
              const typeColors: Record<string, string> = {
                info: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/30',
                feature: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30',
                warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/30',
                maintenance: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/30',
                critical: 'bg-red-500/20 text-red-300 border-red-500/30',
              };
              const typeIcons: Record<string, string> = {
                info: t('opsTypeInfoBadge'), feature: t('opsTypeFeatureBadge'), warning: t('opsTypeWarningBadge'), maintenance: t('opsTypeMaintenanceBadge'), critical: t('opsTypeCriticalBadge'),
              };
              return (
                <Card key={ann.id} className={`bg-muted border-border/30 ${!ann.isActive ? 'opacity-50' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <Megaphone size={14} className="text-amber-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{ann.title}</span>
                          <Badge className={`text-[10px] ${typeColors[ann.type] || typeColors.info}`}>
                            {typeIcons[ann.type] || ann.type}
                          </Badge>
                          {!ann.isActive && <Badge className="text-[10px] bg-muted text-muted-foreground">{t('opsInactive')}</Badge>}
                        </div>
                        {ann.body && (
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{ann.body}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                          <span>{t('opsByAuthor', { author: ann.createdBy || t('opsAdmin') })}</span>
                          <span>•</span>
                          <span>{t('opsOnDate', { date: formatDate(ann.createdAt) })}</span>
                          {ann.endsAt && <span>• {t('opsExpiresOn', { date: formatDate(ann.endsAt) })}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => handleOpsAction('toggle-announcement', { announcementId: ann.id, action: 'toggle-active' })}
                          disabled={actionLoading === 'toggle-announcement'}>
                          {actionLoading === 'toggle-announcement' ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : ann.isActive ? (
                            <ToggleRight size={14} className="text-emerald-accent" />
                          ) : (
                            <ToggleLeft size={14} className="text-muted-foreground" />
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10"
                          onClick={() => handleOpsAction('delete-announcement', { announcementId: ann.id })}
                          disabled={actionLoading === 'delete-announcement'}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {operationsData.announcements.length === 0 && (
              <div className="text-center py-8">
                <Megaphone className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('opsNoAnnouncement')}</p>
                <p className="text-xs text-muted-foreground/60">{t('opsNoAnnouncementHint')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ FEATURE FLAGS ════ */}
      {opsSubTab === 'feature-flags' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag size={16} className="text-cyan-accent" />
              <span className="text-sm font-medium text-foreground">{t('opsFeatureFlagsTitle')}</span>
              <Badge className="text-[10px] bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 border-cyan-500/30">
                {t('opsFlagsEnabledCount', { count: operationsData.featureFlags.filter((f: FeatureFlagItem) => f.isEnabled).length })}
              </Badge>
            </div>
            <Button size="sm" className="h-8 gap-1.5 bg-blue-glow hover:bg-blue-bright"
              onClick={() => setShowNewFlag(!showNewFlag)}>
              <Plus size={14} />
              {t('opsNewFlag')}
            </Button>
          </div>

          {/* New flag form */}
          {showNewFlag && (
            <Card className="bg-muted border-blue-bright/20">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('opsKeyLabel')}</Label>
                    <Input
                      placeholder={t('opsKeyPlaceholder')}
                      value={newFlag.key}
                      onChange={(e) => setNewFlag((p: FlagState) => ({ ...p, key: e.target.value }))}
                      className="h-9 bg-secondary border-border/30 text-foreground font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('opsDisplayNameLabel')}</Label>
                    <Input
                      placeholder={t('opsDisplayNamePlaceholder')}
                      value={newFlag.name}
                      onChange={(e) => setNewFlag((p: FlagState) => ({ ...p, name: e.target.value }))}
                      className="h-9 bg-secondary border-border/30 text-foreground"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('opsDescriptionLabel')}</Label>
                  <Input
                    placeholder={t('opsDescriptionPlaceholder')}
                    value={newFlag.description}
                    onChange={(e) => setNewFlag((p: FlagState) => ({ ...p, description: e.target.value }))}
                    className="h-9 bg-secondary border-border/30 text-foreground"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" className="h-8 text-muted-foreground"
                    onClick={() => { setShowNewFlag(false); setNewFlag({ key: '', name: '', description: '' }); }}>
                    {t('opsCancel')}
                  </Button>
                  <Button size="sm" className="h-8 bg-blue-glow hover:bg-blue-bright"
                    disabled={!newFlag.key.trim() || !newFlag.name.trim() || actionLoading === 'create-flag'}
                    onClick={() => handleOpsAction('create-flag', {
                      key: newFlag.key,
                      name: newFlag.name,
                      description: newFlag.description,
                    })}>
                    {actionLoading === 'create-flag' ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} className="mr-1" />}
                    {t('opsCreate')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feature flags list */}
          <div className="space-y-2">
            {operationsData.featureFlags.map((flag: FeatureFlagItem) => (
              <Card key={flag.id} className="bg-muted border-border/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      flag.isEnabled ? 'bg-emerald-500/20' : 'bg-muted'
                    }`}>
                      <Flag size={14} className={flag.isEnabled ? 'text-emerald-accent' : 'text-muted-foreground'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{flag.name}</span>
                        <code className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">{flag.key}</code>
                        <Badge className={`text-[10px] ${flag.isEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30' : 'bg-muted text-muted-foreground border-gray-500/30'}`}>
                          {flag.isEnabled ? t('opsFlagActive') : t('opsFlagInactive')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        {flag.description && <span>{flag.description}</span>}
                        <span>{t('opsRollout', { pct: flag.rollout })}</span>
                        {flag.planOverride && <span>{t('opsOverridePlans')}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => handleOpsAction('toggle-flag', { flagId: flag.id, action: 'toggle' })}
                        disabled={actionLoading === 'toggle-flag'}>
                        {actionLoading === 'toggle-flag' ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : flag.isEnabled ? (
                          <ToggleRight size={14} className="text-emerald-accent" />
                        ) : (
                          <ToggleLeft size={14} className="text-muted-foreground" />
                        )}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10"
                        onClick={() => handleOpsAction('delete-flag', { flagId: flag.id })}
                        disabled={actionLoading === 'delete-flag'}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {operationsData.featureFlags.length === 0 && (
              <div className="text-center py-8">
                <Flag className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('opsNoFlag')}</p>
                <p className="text-xs text-muted-foreground/60">{t('opsNoFlagHint')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ SUPPORT TICKETS ════ */}
      {opsSubTab === 'support' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Ticket size={16} className="text-rose-accent" />
            <span className="text-sm font-medium text-foreground">{t('opsSupportTitle')}</span>
          </div>

          {/* Ticket Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={<Ticket size={18} className="text-blue-bright" />} label={t('opsKpiOpen')} value={operationsData.supportTickets.stats.open} />
            <KPICard icon={<Clock size={18} className="text-amber-accent" />} label={t('opsKpiPending')} value={operationsData.supportTickets.stats.pending} />
            <KPICard icon={<CheckSquare size={18} className="text-emerald-accent" />} label={t('opsKpiResolved')} value={operationsData.supportTickets.stats.closed} />
            <KPICard icon={<AlertOctagon size={18} className="text-red-400" />} label={t('opsKpiCritical')} value={operationsData.supportTickets.stats.critical} />
          </div>

          {/* Tickets list */}
          <Card className="bg-muted border-border/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('opsRecentTickets', { count: operationsData.supportTickets.total })}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {operationsData.supportTickets.tickets.length > 0 ? (
                <div className="space-y-2">
                  {operationsData.supportTickets.tickets.map((ticket: SupportTicket) => {
                    const statusColors: Record<string, string> = {
                      new: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/30',
                      waiting_on_customer: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/30',
                      waiting_on_us: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/30',
                      resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30',
                      closed: 'bg-muted text-muted-foreground border-gray-500/30',
                    };
                    const statusLabels: Record<string, string> = {
                      new: t('opsTicketNew'), waiting_on_customer: t('opsTicketWaitingCustomer'), waiting_on_us: t('opsTicketWaitingUs'),
                      resolved: t('opsTicketResolved'), closed: t('opsTicketClosed'),
                    };
                    const priorityColors: Record<string, string> = {
                      low: 'text-muted-foreground', medium: 'text-blue-300', high: 'text-amber-400', urgent: 'text-red-400',
                    };
                    return (
                      <div key={ticket.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          ticket.priority === 'urgent' ? 'bg-red-500/20' : ticket.priority === 'high' ? 'bg-amber-500/20' : 'bg-secondary'
                        }`}>
                          <Ticket size={14} className={ticket.priority === 'urgent' ? 'text-red-400' : ticket.priority === 'high' ? 'text-amber-400' : 'text-muted-foreground'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground truncate max-w-md">{ticket.subject}</span>
                            <Badge className={`text-[10px] ${statusColors[ticket.status] || statusColors.new}`}>
                              {statusLabels[ticket.status] || ticket.status}
                            </Badge>
                            <span className={`text-[10px] font-medium ${priorityColors[ticket.priority] || 'text-muted-foreground'}`}>
                              {ticket.priority === 'urgent' ? t('opsPriorityUrgent') : ticket.priority === 'high' ? t('opsPriorityHigh') : ticket.priority === 'medium' ? t('opsPriorityMedium') : t('opsPriorityLow')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            {ticket.contact && <span>{ticket.contact.firstName || ''} {ticket.contact.lastName || ''} {ticket.contact.email ? `(${ticket.contact.email})` : ''}</span>}
                            <span>•</span>
                            <span>{ticket.source}</span>
                            <span>•</span>
                            <span>{t('opsOnDate', { date: formatDate(ticket.createdAt) })}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Ticket className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('opsNoTicket')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════ AUDIT LOGS ════ */}
      {opsSubTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ScrollText size={16} className="text-purple-400" />
            <span className="text-sm font-medium text-foreground">{t('opsAuditTitle')}</span>
          </div>

          {/* Audit Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={<ScrollText size={18} className="text-purple-400" />} label={t('opsKpiToday')} value={operationsData.auditLogs.stats.today} />
            <KPICard icon={<Activity size={18} className="text-blue-bright" />} label={t('opsKpiThisWeek')} value={operationsData.auditLogs.stats.thisWeek} />
            <KPICard icon={<Users size={18} className="text-cyan-accent" />} label={t('opsKpiUsers')} value={operationsData.auditLogs.stats.uniqueUsers} />
            <KPICard icon={<Zap size={18} className="text-emerald-accent" />} label={t('opsKpiActionTypes')} value={operationsData.auditLogs.stats.uniqueActions} />
          </div>

          {/* Logs table */}
          <Card className="bg-muted border-border/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('opsRecentLogs', { count: operationsData.auditLogs.total })}
                </CardTitle>
                <span className="text-[10px] text-muted-foreground">
                  {t('opsPage', { page: operationsData.auditLogs.page, total: operationsData.auditLogs.totalPages })}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {operationsData.auditLogs.logs.length > 0 ? (
                <div className="space-y-1">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] text-muted-foreground font-medium border-b border-border/20">
                    <div className="col-span-2">{t('opsLogDate')}</div>
                    <div className="col-span-2">{t('opsLogAction')}</div>
                    <div className="col-span-2">{t('opsLogEntity')}</div>
                    <div className="col-span-3">{t('opsLogTitle')}</div>
                    <div className="col-span-2">{t('opsLogUser')}</div>
                    <div className="col-span-1">{t('opsLogIp')}</div>
                  </div>
                  {/* Rows */}
                  {operationsData.auditLogs.logs.map((log: AuditLog) => {
                    const actionColors: Record<string, string> = {
                      created: 'text-emerald-400', updated: 'text-blue-300', deleted: 'text-red-400',
                      login: 'text-cyan-400', export: 'text-purple-400', toggle: 'text-amber-400',
                    };
                    return (
                      <div key={log.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs rounded hover:bg-accent/30 transition-colors">
                        <div className="col-span-2 text-muted-foreground text-[10px]">
                          {formatDateTime(log.createdAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className={`col-span-2 text-[11px] font-medium ${actionColors[log.action] || 'text-foreground'}`}>
                          {log.action}
                        </div>
                        <div className="col-span-2 text-muted-foreground text-[11px]">
                          {log.entityType}
                          {log.entityId && <span className="text-[9px] text-muted-foreground/60 ml-1">#{log.entityId.slice(0, 6)}</span>}
                        </div>
                        <div className="col-span-3 text-foreground text-[11px] truncate">
                          {log.entityTitle || '—'}
                        </div>
                        <div className="col-span-2 text-muted-foreground text-[11px] truncate">
                          {log.userId || t('opsSystem')}
                        </div>
                        <div className="col-span-1 text-muted-foreground/60 text-[10px] truncate">
                          {log.ipAddress || '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ScrollText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('opsNoAuditLog')}</p>
                  <p className="text-xs text-muted-foreground/60">{t('opsNoAuditLogHint')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════ EMAIL CONFIG ════ */}
      {opsSubTab === 'email' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-blue-bright" />
            <span className="text-sm font-medium text-foreground">{t('opsEmailConfigTitle')}</span>
          </div>
          <Card className="bg-muted border-border/30">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Email configuration will be implemented in a future update.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  ) : null}
    </div>
  );
}
