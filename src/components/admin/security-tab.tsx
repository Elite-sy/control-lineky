'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  ShieldAlert, ShieldCheck, Fingerprint, Globe, ScrollText,
  Plus, Ban, UserCheck, Trash2, ChevronRight,
  Loader2, Lock, QrCode, Smartphone, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from '@/i18n/client';
import { currentLocale } from '@/i18n/format';
import { useAdminCsrf } from '@/hooks/use-admin-csrf';

interface SecurityAdmin {
  id: string;
  email: string;
  role: string;
  isEnv: boolean;
  isActive: boolean;
  twoFactorEnabled: boolean;
  allowedIps: string[] | null;
  lastLoginIp: string | null;
  lastLoginAt: string | null;
}

export interface SecurityData {
  activeCount: number;
  admins: SecurityAdmin[];
  currentEmail?: string | null;
}

export interface SecurityTabProps {
  securityLoading: boolean;
  securityData: SecurityData | null;
  fetchSecurity: () => void;
  secSubTab: 'admins' | 'twofa' | 'ip-whitelist' | 'audit';
  setSecSubTab: (v: 'admins' | 'twofa' | 'ip-whitelist' | 'audit') => void;
  showAddAdmin: boolean;
  setShowAddAdmin: (v: boolean) => void;
  newAdminEmail: string;
  setNewAdminEmail: (v: string) => void;
  newAdminRole: string;
  setNewAdminRole: (v: string) => void;
  actionLoading: string | null;
  setActionLoading: (v: string | null) => void;
  qrCodeData: { secret: string; qrCodeDataUrl: string; otpAuthUrl: string } | null;
  setQrCodeData: (v: { secret: string; qrCodeDataUrl: string; otpAuthUrl: string } | null) => void;
  twoFaCode: string;
  setTwoFaCode: (v: string) => void;
  twoFaDisableCode: string;
  setTwoFaDisableCode: (v: string) => void;
  ipWhitelistValue: string;
  setIpWhitelistValue: (v: string) => void;
}

export function SecurityTab({
  securityLoading,
  securityData,
  fetchSecurity,
  secSubTab,
  setSecSubTab,
  showAddAdmin,
  setShowAddAdmin,
  newAdminEmail,
  setNewAdminEmail,
  newAdminRole,
  setNewAdminRole,
  actionLoading,
  setActionLoading,
  qrCodeData,
  setQrCodeData,
  twoFaCode,
  setTwoFaCode,
  twoFaDisableCode,
  setTwoFaDisableCode,
  ipWhitelistValue,
  setIpWhitelistValue,
}: SecurityTabProps) {
  const t = useTranslations('adminExt');
  const { fetchWithCsrf } = useAdminCsrf();
  // Current admin = the one whose email matches the authenticated user
  const currentEmail = securityData?.currentEmail?.toLowerCase();
  const currentAdmin = currentEmail
    ? securityData?.admins.find(a => a.email.toLowerCase() === currentEmail)
    : undefined;
  const currentAdminHas2fa = !!currentAdmin?.twoFactorEnabled;

  // Prefill the IP whitelist textarea with the current admin's saved IPs
  useEffect(() => {
    if (!securityData || ipWhitelistValue.trim()) return;
    if (currentAdmin?.allowedIps && currentAdmin.allowedIps.length > 0) {
      setIpWhitelistValue(currentAdmin.allowedIps.join('\n'));
    }
  }, [securityData]);

  return (
    <div className="space-y-4 mt-4">
  {securityLoading ? (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-8 h-8 animate-spin text-blue-bright" />
    </div>
  ) : securityData ? (
    <>
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-2 border-b border-border/30 pb-2">
        {[
          { key: 'admins' as const, label: t('secTabMultiAdmin'), icon: <ShieldAlert size={14} /> },
          { key: 'twofa' as const, label: t('secTab2fa'), icon: <Fingerprint size={14} /> },
          { key: 'ip-whitelist' as const, label: t('secTabIpWhitelist'), icon: <Globe size={14} /> },
          { key: 'audit' as const, label: t('secTabAudit'), icon: <ScrollText size={14} /> },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              secSubTab === tab.key
                ? 'bg-amber-accent/20 text-amber-accent'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
            onClick={() => setSecSubTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <div className="ml-auto">
          <Button variant="outline" size="sm" className="h-7 text-xs border-border/30 text-muted-foreground hover:bg-secondary"
            onClick={fetchSecurity}>
            <Loader2 size={12} className={securityLoading ? 'animate-spin mr-1' : 'mr-1 hidden'} />
            {t('secRefresh')}
          </Button>
        </div>
      </div>

      {/* ════ MULTI-ADMIN ════ */}
      {secSubTab === 'admins' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-accent" />
              <span className="text-sm font-medium text-foreground">{t('secAdminsTitle')}</span>
              <Badge className="text-[10px] bg-amber-accent/20 text-amber-accent border-amber-accent/30">
                {t('secActiveCount', { count: securityData.activeCount })}
              </Badge>
            </div>
            <Button size="sm" className="h-8 gap-1.5 bg-amber-accent/80 hover:bg-amber-accent text-foreground"
              onClick={() => setShowAddAdmin(!showAddAdmin)}>
              <Plus size={14} />
              {t('secAddAdmin')}
            </Button>
          </div>

          {/* Add admin form */}
          {showAddAdmin && (
            <Card className="bg-muted border-amber-accent/20">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('secEmailLabel')}</Label>
                    <Input
                      type="email"
                      placeholder={t('secEmailPlaceholder')}
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="h-9 bg-secondary border-border/30 text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('secRoleLabel')}</Label>
                    <Select value={newAdminRole} onValueChange={(v) => setNewAdminRole(v)}>
                      <SelectTrigger className="h-9 bg-secondary border-border/30 text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/30">
                        <SelectItem value="super_admin">{t('secRoleSuperAdmin')}</SelectItem>
                        <SelectItem value="admin">{t('secRoleAdmin')}</SelectItem>
                        <SelectItem value="readonly">{t('secRoleReadonly')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" className="h-8 text-muted-foreground"
                    onClick={() => { setShowAddAdmin(false); setNewAdminEmail(''); }}>
                    {t('secCancel')}
                  </Button>
                  <Button size="sm" className="h-8 bg-amber-accent/80 hover:bg-amber-accent text-foreground"
                    disabled={!newAdminEmail.trim() || actionLoading === 'add-admin'}
                    onClick={async () => {
                      setActionLoading('add-admin');
                      try {
                        const res = await fetchWithCsrf('/api/admin/admins', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: newAdminEmail, role: newAdminRole }),
                        });
                        const json = await res.json().catch(() => ({}));
                        if (res.ok) { toast.success(json.message); setShowAddAdmin(false); setNewAdminEmail(''); fetchSecurity(); }
                        else toast.error(json.error);
                      } catch { toast.error(t('secNetworkError')); }
                      setActionLoading(null);
                    }}>
                    {actionLoading === 'add-admin' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} className="mr-1" />}
                    {t('secAdd')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admins list */}
          <div className="space-y-2">
            {securityData.admins.map((admin: SecurityAdmin) => {
              const roleLabels: Record<string, string> = { super_admin: t('secRoleSuperAdmin'), admin: t('secRoleAdmin'), readonly: t('secRoleReadonly') };
              const roleColors: Record<string, string> = { super_admin: 'bg-amber-accent/20 text-amber-accent border-amber-accent/30', admin: 'bg-blue-bright/20 text-blue-bright border-blue-bright/30', readonly: 'bg-muted text-muted-foreground border-gray-500/30' };
              return (
                <Card key={admin.id} className={`bg-muted border-border/30 ${!admin.isActive ? 'opacity-50' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${admin.isEnv ? 'bg-amber-accent/20' : 'bg-secondary'}`}>
                        {admin.isEnv ? <ShieldCheck size={14} className="text-amber-accent" /> : <ShieldAlert size={14} className="text-blue-bright" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{admin.email}</span>
                          <Badge className={`text-[10px] ${roleColors[admin.role] || roleColors.admin}`}>
                            {roleLabels[admin.role] || admin.role}
                          </Badge>
                          {admin.isEnv && <Badge className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/30">{t('secBadgeEnvVar')}</Badge>}
                          {admin.twoFactorEnabled && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30">{t('secBadge2fa')}</Badge>}
                          {admin.allowedIps && admin.allowedIps.length > 0 && (
                            <Badge className="text-[10px] bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 border-cyan-500/30">{t('secBadgeIpRestrict')}</Badge>
                          )}
                          {!admin.isActive && <Badge className="text-[10px] bg-red-500/20 text-red-300">{t('secBadgeInactive')}</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          {admin.lastLoginIp && <span>{t('secLastIp', { ip: admin.lastLoginIp })}</span>}
                          {admin.lastLoginAt && <span>• {t('secLastLogin', { date: new Date(admin.lastLoginAt).toLocaleDateString(currentLocale()) })}</span>}
                          {!admin.lastLoginAt && <span>{t('secNoLogin')}</span>}
                        </div>
                      </div>
                      {!admin.isEnv && (
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Change role */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={actionLoading === `role-${admin.id}`}>
                                <ChevronRight size={14} className="text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card border-border/30 w-48">
                              <DropdownMenuLabel className="text-foreground text-xs">{t('secActions')}</DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-border" />
                              {['super_admin', 'admin', 'readonly'].filter(r => r !== admin.role).map(r => (
                                <DropdownMenuItem key={r} className="text-foreground cursor-pointer"
                                  onClick={async () => {
                                    setActionLoading(`role-${admin.id}`);
                                    try {
                                      const res = await fetchWithCsrf('/api/admin/admins', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: admin.id, action: 'change-role', role: r }) });
                                      const json = await res.json().catch(() => ({}));
                                      if (res.ok) { toast.success(json.message); fetchSecurity(); } else toast.error(json.error);
                                    } catch { toast.error(t('secNetworkError')); }
                                    setActionLoading(null);
                                  }}>
                                  <ShieldCheck size={14} className="mr-2" /> {roleLabels[r]}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator className="bg-border" />
                              <DropdownMenuItem className="text-foreground cursor-pointer"
                                onClick={async () => {
                                  setActionLoading(`toggle-${admin.id}`);
                                  try {
                                    const res = await fetchWithCsrf('/api/admin/admins', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: admin.id, action: 'toggle-active' }) });
                                    const json = await res.json().catch(() => ({}));
                                    if (res.ok) { toast.success(json.message); fetchSecurity(); } else toast.error(json.error);
                                  } catch { toast.error(t('secNetworkError')); }
                                  setActionLoading(null);
                                }}>
                                {admin.isActive ? <Ban size={14} className="mr-2 text-red-400" /> : <UserCheck size={14} className="mr-2 text-emerald-400" />}
                                {admin.isActive ? t('secDisable') : t('secReactivate')}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                                onClick={async () => {
                                  setActionLoading(`delete-${admin.id}`);
                                  try {
                                    const res = await fetchWithCsrf('/api/admin/admins', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: admin.id }) });
                                    const json = await res.json().catch(() => ({}));
                                    if (res.ok) { toast.success(json.message); fetchSecurity(); } else toast.error(json.error);
                                  } catch { toast.error(t('secNetworkError')); }
                                  setActionLoading(null);
                                }}>
                                <Trash2 size={14} className="mr-2" /> {t('secDelete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {securityData.admins.length === 0 && (
              <div className="text-center py-8">
                <ShieldAlert className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('secNoAdmin')}</p>
                <p className="text-xs text-muted-foreground/60">{t('secNoAdminHint')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ 2FA ════ */}
      {secSubTab === 'twofa' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Fingerprint size={16} className="text-purple-400" />
            <span className="text-sm font-medium text-foreground">{t('sec2faTitle')}</span>
          </div>

          <Card className="bg-muted border-border/30">
            <CardContent className="p-6">
              {currentAdminHas2fa ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                    <Fingerprint size={28} className="text-emerald-accent" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-foreground">{t('sec2faEnabled')}</p>
                    <p className="text-sm text-muted-foreground">{t('sec2faEnabledDesc')}</p>
                  </div>
                  <div className="space-y-3 max-w-sm mx-auto">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t('sec2faDisableLabel')}</Label>
                      <Input
                        placeholder="000000"
                        value={twoFaDisableCode}
                        onChange={(e) => setTwoFaDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="h-10 bg-secondary border-border/30 text-foreground text-center text-lg tracking-widest font-mono"
                        maxLength={6}
                      />
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-red-400 border-red-500/30 hover:bg-red-500/10"
                      disabled={twoFaDisableCode.length !== 6 || actionLoading === 'disable-2fa'}
                      onClick={async () => {
                        setActionLoading('disable-2fa');
                        try {
                          const res = await fetchWithCsrf('/api/admin/security/2fa', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'disable', code: twoFaDisableCode }),
                          });
                          const json = await res.json().catch(() => ({}));
                          if (res.ok) { toast.success(json.message); setTwoFaDisableCode(''); fetchSecurity(); }
                          else toast.error(json.error);
                        } catch { toast.error(t('secNetworkError')); }
                        setActionLoading(null);
                      }}>
                      {actionLoading === 'disable-2fa' ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                      {t('sec2faDisable')}
                    </Button>
                  </div>
                </div>
              ) : qrCodeData ? (
                <div className="text-center space-y-4">
                  <p className="text-sm font-medium text-foreground">{t('sec2faStep1')}</p>
                  <p className="text-xs text-muted-foreground">{t('sec2faStep1Desc')}</p>
                  <div className="inline-block p-3 rounded-xl bg-white">
                    {}
                    <img src={qrCodeData.qrCodeDataUrl} alt={t('sec2faQrAlt')} width={200} height={200} className="rounded-lg" />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono break-all max-w-md mx-auto">{qrCodeData.otpAuthUrl}</p>

                  <Separator className="bg-border" />

                  <p className="text-sm font-medium text-foreground">{t('sec2faStep2')}</p>
                  <p className="text-xs text-muted-foreground">{t('sec2faStep2Desc')}</p>
                  <div className="space-y-3 max-w-sm mx-auto">
                    <div className="space-y-1">
                      <Input
                        placeholder="000000"
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="h-10 bg-secondary border-border/30 text-foreground text-center text-lg tracking-widest font-mono"
                        maxLength={6}
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-center gap-2">
                      <Button variant="ghost" size="sm" className="h-8 text-muted-foreground"
                        onClick={() => { setQrCodeData(null); setTwoFaCode(''); }}>
                        {t('secCancel')}
                      </Button>
                      <Button size="sm" className="h-8 bg-emerald-accent/80 hover:bg-emerald-accent text-foreground"
                        disabled={twoFaCode.length !== 6 || actionLoading === 'verify-2fa'}
                        onClick={async () => {
                          setActionLoading('verify-2fa');
                          try {
                            const res = await fetchWithCsrf('/api/admin/security/2fa', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'verify', secret: qrCodeData?.secret, code: twoFaCode }),
                            });
                            const json = await res.json().catch(() => ({}));
                            if (res.ok) { toast.success(json.message); setQrCodeData(null); setTwoFaCode(''); fetchSecurity(); }
                            else toast.error(json.error);
                          } catch { toast.error(t('secNetworkError')); }
                          setActionLoading(null);
                        }}>
                        {actionLoading === 'verify-2fa' ? <Loader2 size={14} className="animate-spin mr-1" /> : <Smartphone size={14} className="mr-1" />}
                        {t('sec2faVerify')}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto">
                    <Fingerprint size={28} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-foreground">{t('sec2faNotConfigured')}</p>
                    <p className="text-sm text-muted-foreground">{t('sec2faNotConfiguredDesc')}</p>
                  </div>
                  <Button size="sm" className="gap-1.5 bg-purple-500/80 hover:bg-purple-500"
                    disabled={actionLoading === 'setup-2fa'}
                    onClick={async () => {
                      setActionLoading('setup-2fa');
                      try {
                        const res = await fetchWithCsrf('/api/admin/security/2fa', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'setup' }),
                        });
                        const json = await res.json().catch(() => ({}));
                        if (res.ok) { setQrCodeData({ secret: json.secret, qrCodeDataUrl: json.qrCodeDataUrl, otpAuthUrl: json.otpAuthUrl }); }
                        else toast.error(json.error);
                      } catch { toast.error(t('secNetworkError')); }
                      setActionLoading(null);
                    }}>
                    {actionLoading === 'setup-2fa' ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                    {t('sec2faSetup')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════ IP WHITELIST ════ */}
      {secSubTab === 'ip-whitelist' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-cyan-accent" />
            <span className="text-sm font-medium text-foreground">{t('secIpTitle')}</span>
          </div>

          <Card className="bg-muted border-border/30">
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {t('secIpDesc')}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t('secIpLabel')}</Label>
                <Textarea
                  placeholder={"192.168.1.100\n10.0.0.0/8\n203.0.113.0/24"}
                  value={ipWhitelistValue}
                  onChange={(e) => setIpWhitelistValue(e.target.value)}
                  className="min-h-[100px] bg-secondary border-border/30 text-foreground font-mono text-xs resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-8 text-red-400 border-red-500/30 hover:bg-red-500/10"
                  onClick={async () => {
                    try {
                      const res = await fetchWithCsrf('/api/admin/security/ip-whitelist', {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ allowedIps: null }),
                      });
                      const json = await res.json().catch(() => ({}));
                      if (res.ok) { toast.success(json.message); setIpWhitelistValue(''); fetchSecurity(); }
                      else toast.error(json.error);
                    } catch { toast.error(t('secNetworkError')); }
                  }}>
                  <X size={14} className="mr-1" />
                  {t('secRemoveFilter')}
                </Button>
                <Button size="sm" className="h-8 bg-cyan-accent/80 hover:bg-cyan-accent text-foreground"
                  disabled={actionLoading === 'save-ip'}
                  onClick={async () => {
                    setActionLoading('save-ip');
                    const ips = ipWhitelistValue.trim().split('\n').map(s => s.trim()).filter(Boolean);
                    try {
                      const res = await fetchWithCsrf('/api/admin/security/ip-whitelist', {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ allowedIps: ips.length > 0 ? ips : null }),
                      });
                      const json = await res.json().catch(() => ({}));
                      if (res.ok) { toast.success(json.message); fetchSecurity(); }
                      else toast.error(json.error);
                    } catch { toast.error(t('secNetworkError')); }
                    setActionLoading(null);
                  }}>
                  {actionLoading === 'save-ip' ? <Loader2 size={14} className="animate-spin mr-1" /> : <Globe size={14} className="mr-1" />}
                  {t('secSave')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current admins with IP restrictions */}
          {securityData.admins.some((a: SecurityAdmin) => a.allowedIps && a.allowedIps.length > 0) && (
            <Card className="bg-muted border-border/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('secIpRestrictedTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {securityData.admins.filter((a: SecurityAdmin) => a.allowedIps && a.allowedIps.length > 0).map((a: SecurityAdmin) => (
                  <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted">
                    <Globe size={14} className="text-cyan-accent shrink-0" />
                    <span className="text-sm text-foreground flex-1">{a.email}</span>
                    <div className="flex flex-wrap gap-1">
                      {a.allowedIps!.map((ip: string, i: number) => (
                        <code key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-cyan-300 font-mono">{ip}</code>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ════ AUDIT IMMUTABLE ════ */}
      {secSubTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ScrollText size={16} className="text-emerald-accent" />
            <span className="text-sm font-medium text-foreground">{t('secAuditTitle')}</span>
          </div>

          <Card className="bg-muted border-emerald-500/20">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                  <Lock size={28} className="text-emerald-accent" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">{t('secProtectionActive')}</p>
                  <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                    {t('secAuditDesc')}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-lg mx-auto">
                  <div className="p-3 rounded-lg bg-muted">
                    <Lock size={18} className="text-red-400 mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground">{t('secUpdateBlocked')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <Trash2 size={18} className="text-red-400 mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground">{t('secDeleteBlocked')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <ShieldCheck size={18} className="text-emerald-accent mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground">{t('secInsertOnly')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted border-border/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('secAuditPropsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: t('secPropNonRepudiation'), desc: t('secPropNonRepudiationDesc'), icon: <ShieldCheck size={14} className="text-blue-bright" /> },
                { label: t('secPropIntegrity'), desc: t('secPropIntegrityDesc'), icon: <Lock size={14} className="text-emerald-accent" /> },
                { label: t('secPropTraceability'), desc: t('secPropTraceabilityDesc'), icon: <ScrollText size={14} className="text-purple-400" /> },
                { label: t('secPropCompliance'), desc: t('secPropComplianceDesc'), icon: <ShieldAlert size={14} className="text-amber-accent" /> },
              ].map((prop, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    {prop.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{prop.label}</p>
                    <p className="text-xs text-muted-foreground">{prop.desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  ) : null}
    </div>
  );
}
