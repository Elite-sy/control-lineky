'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Building2, Users, TrendingUp, Contact, CheckSquare,
  Ticket, Receipt, Crown, Shield, Eye, EyeOff,
  ChevronRight, AlertTriangle, Loader2, Search,
  UserCheck, UserX, ShieldCheck, Trash2, Ban,
  CreditCard,
  BarChart3, Wrench,
  Lock, Mail,
} from 'lucide-react';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { KPICard } from '@/components/admin/kpi-card';
import { BillingTab } from '@/components/admin/billing-tab';
import { AnalyticsTab } from '@/components/admin/analytics-tab';
import { OperationsTab } from '@/components/admin/operations-tab';
import { SecurityTab } from '@/components/admin/security-tab';
import { useTranslations } from '@/i18n/client';
import { currentLocale } from '@/i18n/format';
import { useAdminCsrf } from '@/hooks/use-admin-csrf';

// ─── Types ────────────────────────────────────────────────────────

interface PlatformStats {
  totalWorkspaces: number;
  totalUsers: number;
  totalContacts: number;
  totalDeals: number;
  totalCompanies: number;
  totalTasks: number;
  totalTickets: number;
}

interface PlanDist { plan: string; count: number }
interface BillingInfo { activeSubscriptions: number; mrr: number; currency: string }

interface RecentWorkspace {
  id: string; name: string; slug: string; plan: string;
  createdAt: string; _count: { members: number };
}

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

interface OverviewData {
  stats: PlatformStats;
  planDistribution: PlanDist[];
  billing: BillingInfo;
  recentWorkspaces: RecentWorkspace[];
  allWorkspaces: WorkspaceFull[];
}

// ── Types Utilisateurs ──

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

// ── Types Billing ──

interface MrrHistoryPoint { month: string; mrr: number; count: number }

interface BillingAlert {
  type: string;
  severity: 'warning' | 'critical';
  workspaceId: string;
  workspaceName: string;
  message: string;
  days?: number;
  date?: string;
}

interface TrialItem {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  planName: string;
  status: string;
  trialStatus: 'active' | 'expired' | 'converted';
  trialStart: string | null;
  trialEnd: string | null;
  daysLeft: number | null;
  squareSubscriptionId: string | null;
}

interface BillingSubscription {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialStart: string | null;
  trialEnd: string | null;
  lastBilledAt: string | null;
  nextBillingDate: string | null;
  squareSubscriptionId: string | null;
  createdAt: string;
  workspace: { id: string; name: string; slug: string; isActive: boolean };
  plan: { name: string; displayName: string; price: number; yearlyPrice: number | null; interval: string };
}

interface FreeWorkspace {
  id: string; name: string; slug: string; createdAt: string; _count: { members: number };
}

interface BillingData {
  mrr: number;
  arr: number;
  currency: string;
  activeSubscriptions: number;
  totalSubscriptions: number;
  mrrHistory: MrrHistoryPoint[];
  statusDistribution: Record<string, number>;
  revenueByPlan: Record<string, number>;
  subscriptions: BillingSubscription[];
  alerts: BillingAlert[];
  trials: TrialItem[];
  freeWorkspaces: FreeWorkspace[];
}

type ConfirmAction = {
  type: string;
  ws?: WorkspaceFull;
  newPlan?: string;
  user?: PlatformUser;
  userId?: string;
  workspaceId?: string;
  actionLabel?: string;
  actionDescription?: string;
  billingAction?: string;
  billingWorkspaceId?: string;
  billingPayload?: Record<string, unknown>;
};

// ── Types Analytics ──

interface ChurnHistoryPoint { month: string; churnRate: number; churned: number; total: number }
interface UserGrowthPoint { month: string; newUsers: number; cumulative: number }
interface HeatmapWorkspace {
  workspaceId: string; workspaceName: string; workspaceSlug: string;
  plan: string; isActive: boolean; createdAt: string;
  daysSinceCreation: number; features: Record<string, number>;
  totalActivity: number; featuresUsed: number; maxFeatures: number;
  adoptionScore: number; activityPerDay: number;
}
interface FeatureStat { feature: string; workspaces: number; total: number; avg: number; adoptionRate: number }
interface AnalyticsReport {
  period: { from: string; to: string; generatedAt: string; month: string }
  platform: Record<string, number>
  billing: Record<string, number>
  featureAdoption: FeatureStat[]
  topWorkspaces: Array<{ name: string; plan: string; totalActivity: number; adoptionScore: number; activityPerDay: number }>
}

interface AnalyticsData {
  churn: {
    rate30d: number; rate90d: number;
    churnedLast30Days: number; churnedLast90Days: number;
    history: ChurnHistoryPoint[];
  }
  activation: {
    totalUsers: number; activeUsers: number; inactiveUsers: number;
    recentlyActive: number; powerUsers: number;
    activationRate: number; powerUserRate: number;
    userGrowth: UserGrowthPoint[];
  }
  heatmap: {
    workspaces: HeatmapWorkspace[]
    featureStats: Record<string, FeatureStat>
  }
  report: AnalyticsReport
}

// ── Types Operations (Phase 5) ──

interface Announcement {
  id: string; title: string; body: string | null; type: string;
  priority: number; isActive: boolean; startsAt: string; endsAt: string | null;
  createdBy: string | null; createdAt: string; updatedAt: string;
}

interface FeatureFlagItem {
  id: string; key: string; name: string; description: string | null;
  isEnabled: boolean; planOverride: Record<string, boolean> | null;
  workspaceOverrides: Record<string, boolean> | null;
  rollout: number; createdBy: string | null; createdAt: string; updatedAt: string;
}

interface SupportTicket {
  id: string; subject: string; description: string | null;
  status: string; priority: string; source: string;
  assignedTo: string | null; createdAt: string; updatedAt: string;
  contactId: string | null;
  contact: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
}

interface AuditLogEntry {
  id: string; action: string; entityType: string; entityId: string | null;
  entityTitle: string | null; userId: string | null; details: Record<string, unknown> | null;
  ipAddress: string | null; userAgent: string | null; createdAt: string; workspaceId: string | null;
}

interface OperationsData {
  announcements: Announcement[];
  featureFlags: FeatureFlagItem[];
  supportTickets: {
    tickets: SupportTicket[];
    total: number; page: number; limit: number; totalPages: number;
    stats: { open: number; pending: number; closed: number; critical: number; total: number };
  };
  auditLogs: {
    logs: AuditLogEntry[];
    total: number; page: number; limit: number; totalPages: number;
    stats: { today: number; thisWeek: number; total: number; uniqueUsers: number; uniqueActions: number };
  };
}

// ── Types Security (Phase 6) ──

interface PlatformAdminItem {
  id: string; email: string; role: string; isActive: boolean;
  twoFactorEnabled: boolean; allowedIps: string[] | null;
  lastLoginAt: string | null; lastLoginIp: string | null;
  createdBy: string | null; createdAt: string; updatedAt: string;
  isEnv?: boolean;
}

interface SecurityData {
  admins: PlatformAdminItem[];
  total: number; activeCount: number;
}

// ─── Component ────────────────────────────────────────────────────

export default function AdminPage() {
  const t = useTranslations('admin');
  const tApp = useTranslations('app');
  const { fetchWithCsrf } = useAdminCsrf();
  const [data, setData] = useState<OverviewData | null>(null);
  const [usersData, setUsersData] = useState<UsersData | null>(null);
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [operationsData, setOperationsData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [operationsLoading, setOperationsLoading] = useState(false);
  // Operations sub-states
  const [opsSubTab, setOpsSubTab] = useState<'announcements' | 'feature-flags' | 'support' | 'audit' | 'email'>('announcements');
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false);
  const [showNewFlag, setShowNewFlag] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', body: '', type: 'info' });
  const [newFlag, setNewFlag] = useState({ key: '', name: '', description: '' });
  const [securityData, setSecurityData] = useState<SecurityData | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [secSubTab, setSecSubTab] = useState<'admins' | 'twofa' | 'ip-whitelist' | 'audit'>('admins');
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('admin');
  const [qrCodeData, setQrCodeData] = useState<{ secret: string; qrCodeDataUrl: string; otpAuthUrl: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaDisableCode, setTwoFaDisableCode] = useState('');
  const [ipWhitelistValue, setIpWhitelistValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  // ── Search & Filter ──
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // ── Fetch overview ──
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithCsrf('/api/admin/overview');
      if (res.status === 403) {
        setError(t('accessDenied'));
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.debug || t('loadError'));
      }
      const json = await res.json().catch(() => ({}));
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch users ──
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetchWithCsrf('/api/admin/users');
      if (res.status === 403) {
        toast.error(t('accessDenied'));
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.debug || t('loadError'));
      }
      const json = await res.json().catch(() => ({}));
      setUsersData(json);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  // ── Fetch billing ──
  const fetchBilling = useCallback(async () => {
    setBillingLoading(true);
    try {
      const res = await fetchWithCsrf('/api/admin/billing');
      if (res.status === 403) {
        toast.error(t('accessDenied'));
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.debug || t('loadError'));
      }
      const json = await res.json().catch(() => ({}));
      setBillingData(json);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBillingLoading(false);
    }
  }, []);

  // Charger les users quand on clique sur l'onglet
  useEffect(() => {
    if (activeTab === 'users' && !usersData && !usersLoading) {
      fetchUsers();
    }
  }, [activeTab, usersData, usersLoading, fetchUsers]);

  // Charger billing quand on clique sur l'onglet
  useEffect(() => {
    if (activeTab === 'billing' && !billingData && !billingLoading) {
      fetchBilling();
    }
  }, [activeTab, billingData, billingLoading, fetchBilling]);

  // ── Fetch analytics ──
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetchWithCsrf('/api/admin/analytics');
      if (res.status === 403) {
        toast.error(t('accessDenied'));
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.debug || t('loadError'));
      }
      const json = await res.json().catch(() => ({}));
      setAnalyticsData(json);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Charger analytics quand on clique sur l'onglet
  useEffect(() => {
    if (activeTab === 'analytics' && !analyticsData && !analyticsLoading) {
      fetchAnalytics();
    }
  }, [activeTab, analyticsData, analyticsLoading, fetchAnalytics]);

  // ── Fetch operations ──
  const fetchOperations = useCallback(async () => {
    setOperationsLoading(true);
    try {
      const [annRes, flagsRes, ticketsRes, logsRes] = await Promise.all([
        fetchWithCsrf('/api/admin/announcements'),
        fetchWithCsrf('/api/admin/feature-flags'),
        fetchWithCsrf('/api/admin/support-tickets'),
        fetchWithCsrf('/api/admin/audit-logs'),
      ]);

      if (annRes.status === 403 || flagsRes.status === 403) {
        toast.error(t('accessDenied'));
        return;
      }

      const [annJson, flagsJson, ticketsJson, logsJson] = await Promise.all([
        annRes.json().catch(() => ({ announcements: [] })),
        flagsRes.json().catch(() => ({ flags: [] })),
        ticketsRes.json().catch(() => ({ tickets: [], total: 0, page: 1, limit: 25, totalPages: 0, stats: { open: 0, pending: 0, closed: 0, critical: 0, total: 0 } })),
        logsRes.json().catch(() => ({ logs: [], total: 0, page: 1, limit: 50, totalPages: 0, stats: { today: 0, thisWeek: 0, total: 0, uniqueUsers: 0, uniqueActions: 0 } })),
      ]);

      setOperationsData({
        announcements: annJson.announcements || [],
        featureFlags: flagsJson.flags || [],
        supportTickets: ticketsJson,
        auditLogs: logsJson,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOperationsLoading(false);
    }
  }, []);

  // Charger operations quand on clique sur l'onglet
  useEffect(() => {
    if (activeTab === 'operations' && !operationsData && !operationsLoading) {
      fetchOperations();
    }
  }, [activeTab, operationsData, operationsLoading, fetchOperations]);

  // ── Fetch security ──
  const fetchSecurity = useCallback(async () => {
    setSecurityLoading(true);
    try {
      const res = await fetchWithCsrf('/api/admin/admins');
      if (res.status === 403) {
        toast.error(t('accessDenied'));
        return;
      }
      const json = await res.json().catch(() => ({ admins: [], total: 0, activeCount: 0 }));
      setSecurityData(json);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSecurityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'security' && !securityData && !securityLoading) {
      fetchSecurity();
    }
  }, [activeTab, securityData, securityLoading, fetchSecurity]);

  // ── Operations Actions ──
  async function handleOpsAction(action: string, payload?: Record<string, unknown>) {
    setActionLoading(action);
    try {
      let endpoint = '/api/admin/announcements';
      if (action.startsWith('flag')) endpoint = '/api/admin/feature-flags';
      const res = await fetchWithCsrf(endpoint, {
        method: action === 'create-announcement' ? 'POST' : action === 'delete-announcement' ? 'DELETE' : action === 'toggle-announcement' ? 'PATCH' : action === 'create-flag' ? 'POST' : action === 'toggle-flag' ? 'PATCH' : action === 'delete-flag' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(json.message || t('actionDone'));
        if (action === 'create-announcement') { setShowNewAnnouncement(false); setNewAnnouncement({ title: '', body: '', type: 'info' }); }
        if (action === 'create-flag') { setShowNewFlag(false); setNewFlag({ key: '', name: '', description: '' }); }
        fetchOperations();
      } else {
        toast.error(json.error || t('actionError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setActionLoading(null);
    }
  }

  // ── Workspace Actions ──
  async function handleWsAction(wsId: string, action: string, payload?: Record<string, unknown>) {
    setActionLoading(wsId);
    try {
      const res = await fetchWithCsrf('/api/admin/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: wsId, action, ...payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(t('actionApplied', { action }));
        fetchOverview();
      } else {
        toast.error(json.error || t('actionError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }

  // ── Billing Actions ──
  async function handleBillingAction(workspaceId: string, action: string, payload?: Record<string, unknown>) {
    setActionLoading(`billing-${workspaceId}`);
    try {
      const res = await fetchWithCsrf('/api/admin/billing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, action, ...payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(json.message || t('actionApplied', { action }));
        fetchBilling();
        fetchOverview();
      } else {
        toast.error(json.error || t('actionError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }

  // ── User Actions ──
  async function handleUserAction(userId: string, action: string, payload?: Record<string, unknown>) {
    setActionLoading(`user-${userId}`);
    try {
      const res = await fetchWithCsrf('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, ...payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(json.message || t('actionApplied', { action }));
        fetchUsers();
        fetchOverview(); // refresh overview stats
      } else {
        toast.error(json.error || t('actionError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }

  // ── Helpers ──
  function planLabel(plan: string) {
    const labels: Record<string, string> = { free: t('planFree'), pro: t('planPro'), enterprise: t('planEnterprise') }
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
    const labels: Record<string, string> = { admin: t('roleAdmin'), manager: t('roleManager'), member: t('roleMember'), user: t('roleMember') }
    return labels[role] || role
  }

  function statusBadge(status: string | null) {
    if (!status) return <Badge variant="outline" className="text-muted-foreground">{t('none')}</Badge>
    const active = ['active', 'trialing'].includes(status)
    return (
      <Badge className={active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}>
        {status === 'active' ? t('activeStatus') : status === 'trialing' ? t('trialStatus') : status}
      </Badge>
    )
  }

  // ── Filtered users ──
  const filteredUsers = useMemo(() => {
    if (!usersData) return [];
    return usersData.users.filter(u => {
      // Status filter
      if (userStatusFilter === 'active' && !u.isActive) return false;
      if (userStatusFilter === 'inactive' && u.isActive) return false;
      // Search filter
      if (userSearch) {
        const q = userSearch.toLowerCase();
        return (
          u.email.toLowerCase().includes(q) ||
          (u.fullName && u.fullName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [usersData, userSearch, userStatusFilter]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-bright" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-12 h-12 text-amber-accent" />
        <p className="text-muted-foreground text-center">{error}</p>
        <Button variant="outline" onClick={fetchOverview}>{tApp('retry')}</Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-accent/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-amber-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('consoleTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('consoleSubtitle')}</p>
        </div>
        <Badge className="bg-amber-accent/20 text-amber-accent border-amber-accent/30 ml-auto">
          {t('superAdmin')}
        </Badge>
      </div>

      <Separator className="bg-border" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary border border-border/30">
          <TabsTrigger value="overview" className="data-[state=active]:bg-secondary">
            <TrendingUp size={14} className="mr-1.5" /> {t('overview')}
          </TabsTrigger>
          <TabsTrigger value="workspaces" className="data-[state=active]:bg-secondary">
            <Building2 size={14} className="mr-1.5" /> {t('workspaces')}
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-secondary">
            <Users size={14} className="mr-1.5" /> {t('users')}
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-secondary">
            <CreditCard size={14} className="mr-1.5" /> {t('billing')}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-secondary">
            <BarChart3 size={14} className="mr-1.5" /> {t('analytics')}
          </TabsTrigger>
          <TabsTrigger value="email" className="data-[state=active]:bg-secondary">
            <Mail size={14} className="mr-1.5" /> {t('emailTab')}
          </TabsTrigger>
          <TabsTrigger value="operations" className="data-[state=active]:bg-secondary">
            <Wrench size={14} className="mr-1.5" /> {t('tools')}
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-secondary">
            <Lock size={14} className="mr-1.5" /> {t('security')}
          </TabsTrigger>
        </TabsList>

        {/* ═══ OVERVIEW TAB ═══ */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={<Building2 size={18} className="text-cyan-accent" />} label={t('workspaces')} value={data.stats.totalWorkspaces} />
            <KPICard icon={<Users size={18} className="text-blue-bright" />} label={t('users')} value={data.stats.totalUsers} />
            <KPICard icon={<Contact size={18} className="text-emerald-accent" />} label={t('contacts')} value={data.stats.totalContacts} />
            <KPICard icon={<TrendingUp size={18} className="text-amber-accent" />} label={t('dealsLabel')} value={data.stats.totalDeals} />
            <KPICard icon={<Receipt size={18} className="text-purple-400" />} label={tApp('invoice')} value="—" />
            <KPICard icon={<CheckSquare size={18} className="text-violet-400" />} label={tApp('task')} value={data.stats.totalTasks} />
            <KPICard icon={<Ticket size={18} className="text-rose-accent" />} label={tApp('ticket')} value={data.stats.totalTickets} />
            <KPICard
              icon={<Crown size={18} className="text-yellow-400" />}
              label={t('mrr')}
              value={`${data.billing.mrr} €`}
              subtitle={t('activeSubscriptions', { count: data.billing.activeSubscriptions })}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-muted border-border/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('planDistribution')}</CardTitle>
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
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('recentWorkspaces')}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentWorkspaces.length > 0 ? (
                  <div className="space-y-2">
                    {data.recentWorkspaces.map((ws) => (
                      <div key={ws.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary cursor-pointer transition-colors"
                        onClick={() => setActiveTab('workspaces')}>
                        <Building2 size={14} className="text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground flex-1 truncate">{ws.name}</span>
                        <Badge className={`text-[10px] ${planBadgeColor(ws.plan)}`}>{planLabel(ws.plan)}</Badge>
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('noRecentWorkspaces')}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ WORKSPACES TAB ═══ */}
        <TabsContent value="workspaces" className="space-y-4 mt-4">
          <div className="space-y-3">
            {data.allWorkspaces.map((ws) => (
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
                        {!ws.isActive && <Badge className="text-[10px] bg-red-500/20 text-red-300 border-red-500/30">{t('inactive')}</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{t('members', { count: ws._count.members })}</span>
                        <span>•</span>
                        <span>{t('createdOn')} {new Date(ws.createdAt).toLocaleDateString(currentLocale())}</span>
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
                              {m.user.email} ({m.role})
                            </span>
                          ))}
                          {ws.members.length > 5 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                              {t('otherMembers', { count: ws.members.length - 5 })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {ws.plan !== 'pro' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-cyan-accent hover:bg-cyan-accent/10"
                          onClick={() => setConfirmAction({ type: 'change-plan', ws, newPlan: 'pro' })}>
                          {t('planPro')}
                        </Button>
                      )}
                      {ws.plan !== 'enterprise' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-purple-400 hover:bg-purple-400/10"
                          onClick={() => setConfirmAction({ type: 'change-plan', ws, newPlan: 'enterprise' })}>
                          {t('planEnterprise')}
                        </Button>
                      )}
                      {ws.plan !== 'free' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:bg-secondary"
                          onClick={() => setConfirmAction({ type: 'change-plan', ws, newPlan: 'free' })}>
                          {t('planFree')}
                        </Button>
                      )}

                      <Separator orientation="vertical" className="h-6 bg-border mx-1" />

                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => handleWsAction(ws.id, 'toggle-active')}
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

          {data.allWorkspaces.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{t('noWorkspaces')}</p>
            </div>
          )}
        </TabsContent>

        {/* ═══ USERS TAB ═══ */}
        <TabsContent value="users" className="space-y-4 mt-4">
          {usersLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-blue-bright" />
            </div>
          ) : usersData ? (
            <>
              {/* User Stats */}
              <div className="grid grid-cols-3 gap-4">
                <KPICard icon={<Users size={18} className="text-blue-bright" />} label={t('total')} value={usersData.stats.total} />
                <KPICard icon={<UserCheck size={18} className="text-emerald-accent" />} label={t('active')} value={usersData.stats.totalActive} />
                <KPICard icon={<UserX size={18} className="text-red-400" />} label={t('inactiveUsers')} value={usersData.stats.totalInactive} />
              </div>

              {/* Search & Filter Bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('searchUsers')}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9 h-9 bg-secondary border-border/30 text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
                <Select value={userStatusFilter} onValueChange={(v) => setUserStatusFilter(v as 'all' | 'active' | 'inactive')}>
                  <SelectTrigger className="w-36 h-9 bg-secondary border-border/30 text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/30">
                    <SelectItem value="all">{tApp('all')}</SelectItem>
                    <SelectItem value="active">{t('active')}</SelectItem>
                    <SelectItem value="inactive">{t('inactiveUsers')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-9 border-border/30 text-muted-foreground hover:bg-secondary"
                  onClick={fetchUsers}>
                  <Loader2 size={14} className={usersLoading ? 'animate-spin mr-1.5' : 'mr-1.5 hidden'} />
                  {t('refresh')}
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
                              <Badge className="text-[10px] bg-red-500/20 text-red-300 border-red-500/30">{t('inactive')}</Badge>
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
                            {t('joinedOn')} {new Date(u.createdAt).toLocaleDateString(currentLocale())}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {t('workspacesCount', { count: u.memberships.length })}
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
                              {t('actionsFor')} {u.email.split('@')[0]}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-border" />

                            {u.isActive ? (
                              <DropdownMenuItem
                                className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                                onClick={() => setConfirmAction({
                                  type: 'toggle-user-active',
                                  user: u,
                                  userId: u.id,
                                  actionLabel: t('confirmDisableUser', { email: u.email }),
                                  actionDescription: t('confirmDisableDesc'),
                                })}>
                                <Ban size={14} className="mr-2" />
                                {t('deactivateAccount')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-emerald-accent focus:text-emerald-300 focus:bg-emerald-accent/10 cursor-pointer"
                                onClick={() => setConfirmAction({
                                  type: 'toggle-user-active',
                                  user: u,
                                  userId: u.id,
                                  actionLabel: t('confirmReenableUser', { email: u.email }),
                                  actionDescription: t('confirmReenableDesc'),
                                })}>
                                <UserCheck size={14} className="mr-2" />
                                {t('reactivateAccount')}
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator className="bg-border" />

                            {/* Change role in each workspace */}
                            {u.memberships.map((m) => (
                              <div key={m.workspace.id}>
                                <DropdownMenuLabel className="text-[10px] text-muted-foreground px-2 py-1">
                                  {t('workspaceLabel', { name: m.workspace.name })}
                                </DropdownMenuLabel>
                                {['admin', 'manager', 'member'].filter(r => r !== m.role).map(r => (
                                  <DropdownMenuItem
                                    key={r}
                                    className="text-foreground cursor-pointer"
                                    onClick={() => handleUserAction(u.id, 'change-role', {
                                      workspaceId: m.workspace.id,
                                      role: r,
                                    })}>
                                    <ShieldCheck size={14} className="mr-2" />
                                    {t('roleChange')} {roleLabel(r)}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuItem
                                  className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                                  onClick={() => setConfirmAction({
                                    type: 'remove-from-workspace',
                                    user: u,
                                    userId: u.id,
                                    workspaceId: m.workspace.id,
                                    actionLabel: t('confirmRemoveUser', { email: u.email, workspace: m.workspace.name }),
                                    actionDescription: t('confirmRemoveDesc'),
                                  })}>
                                  <Trash2 size={14} className="mr-2" />
                                  {t('removeFromWorkspace')}
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
                        ? t('noUsersWithFilters')
                        : t('noUsers')}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* ═══ BILLING TAB ═══ */}
        <TabsContent value="billing" className="space-y-4 mt-4">
          <BillingTab
            data={billingData}
            loading={billingLoading}
            onRefresh={fetchBilling}
            onSetConfirmAction={setConfirmAction}
            onBillingAction={handleBillingAction}
          />
        </TabsContent>

        {/* ═══ ANALYTICS TAB ═══ */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <AnalyticsTab
            data={analyticsData}
            loading={analyticsLoading}
            onRefresh={fetchAnalytics}
          />
        </TabsContent>
        {/* ═══ EMAIL TAB ═══ */}
        <TabsContent value="email" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-blue-bright" />
              <span className="text-sm font-medium text-foreground">{t('emailConfigTitle')}</span>
            </div>
            <Card className="bg-muted border-border/30">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Email configuration will be implemented in a future update.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ OPERATIONS TAB ═══ */}
        <TabsContent value="operations" className="space-y-4 mt-4">
          <OperationsTab
            operationsLoading={operationsLoading}
            operationsData={operationsData as Parameters<typeof OperationsTab>[0]['operationsData']}
            fetchOperations={fetchOperations}
            opsSubTab={opsSubTab}
            setOpsSubTab={setOpsSubTab}
            showNewAnnouncement={showNewAnnouncement}
            setShowNewAnnouncement={setShowNewAnnouncement}
            newAnnouncement={newAnnouncement}
            setNewAnnouncement={setNewAnnouncement}
            showNewFlag={showNewFlag}
            setShowNewFlag={setShowNewFlag}
            newFlag={newFlag}
            setNewFlag={setNewFlag}
            actionLoading={actionLoading}
            handleOpsAction={handleOpsAction}
          />
        </TabsContent>

        {/* ═══ SECURITY TAB ═══ */}
        <TabsContent value="security" className="space-y-4 mt-4">
          <SecurityTab
            securityLoading={securityLoading}
            securityData={securityData as Parameters<typeof SecurityTab>[0]['securityData']}
            fetchSecurity={fetchSecurity}
            secSubTab={secSubTab}
            setSecSubTab={setSecSubTab}
            showAddAdmin={showAddAdmin}
            setShowAddAdmin={setShowAddAdmin}
            newAdminEmail={newAdminEmail}
            setNewAdminEmail={setNewAdminEmail}
            newAdminRole={newAdminRole}
            setNewAdminRole={setNewAdminRole}
            actionLoading={actionLoading}
            setActionLoading={setActionLoading}
            qrCodeData={qrCodeData}
            setQrCodeData={setQrCodeData}
            twoFaCode={twoFaCode}
            setTwoFaCode={setTwoFaCode}
            twoFaDisableCode={twoFaDisableCode}
            setTwoFaDisableCode={setTwoFaDisableCode}
            ipWhitelistValue={ipWhitelistValue}
            setIpWhitelistValue={setIpWhitelistValue}
          />
        </TabsContent>

      </Tabs>

      {/* Confirmation Dialog — unified for all actions */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent className="bg-card border-border/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {confirmAction?.actionLabel || t('confirmAction')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {confirmAction?.actionDescription || ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border/30 text-foreground hover:bg-muted">
              {tApp('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-glow hover:bg-blue-bright text-white"
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === 'change-plan' && confirmAction.ws) {
                  handleWsAction(confirmAction.ws.id, 'change-plan', { plan: confirmAction.newPlan });
                } else if (confirmAction.type === 'toggle-user-active' && confirmAction.userId) {
                  handleUserAction(confirmAction.userId, 'toggle-active');
                } else if (confirmAction.type === 'remove-from-workspace' && confirmAction.userId) {
                  if (confirmAction.workspaceId) {
                    handleUserAction(confirmAction.userId, 'remove-from-workspace', { workspaceId: confirmAction.workspaceId });
                  }
                } else if (confirmAction.billingAction && confirmAction.billingWorkspaceId) {
                  handleBillingAction(confirmAction.billingWorkspaceId, confirmAction.billingAction, confirmAction.billingPayload);
                }
              }}
            >
              {tApp('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────
