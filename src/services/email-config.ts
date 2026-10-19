// ─── Email Config Service ─────────────────────────────────────────────
// Manages per-workspace email domain configuration via Resend API.
// Handles DNS verification, credit tracking, and shared domain fallback.

import { db } from '@lineky/database';
import { Prisma } from '@lineky/database';
import { logger, getErrorMessage } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────

export interface DnsRecord {
  type: string; // "TXT", "CNAME", "MX"
  name: string; // "@" or "resend._domainkey.acme.com"
  value: string; // the record value
  status?: 'pending' | 'verified' | 'not_found';
}

export interface EmailConfigStatus {
  configured: boolean;
  provider: 'resend' | 'smtp' | 'console';
  fromEmail: string | null;
  fromName: string | null;
  domain: string | null;
  domainStatus: 'none' | 'pending' | 'verified' | 'failed';
  useSharedDomain: boolean;
  dnsRecords: DnsRecord[];
  creditsRemaining: number;
  creditsTotal: number;
  creditsBonus: number;
}

export interface DomainCreateResult {
  success: boolean;
  domainId?: string;
  dnsRecords?: DnsRecord[];
  error?: string;
}

export interface DomainVerifyResult {
  success: boolean;
  status?: 'pending' | 'verified' | 'failed';
  dnsRecords?: DnsRecord[];
  error?: string;
}

// ─── In-memory cache for Resend API key ──────────────────────────
let _cachedResendApiKey: string | null | undefined = undefined; // undefined = not loaded yet
let _cachedResendApiKeyAt = 0;
const API_KEY_CACHE_TTL = 60_000; // 1 minute

// ─── Resend API wrapper ──────────────────────────────────────

const RESEND_BASE = 'https://api.resend.com';

export async function getResendApiKey(): Promise<string | null> {
  const now = Date.now();
  if (_cachedResendApiKey !== undefined && now - _cachedResendApiKeyAt < API_KEY_CACHE_TTL) {
    return _cachedResendApiKey;
  }

  try {
    const config = await db.systemConfig.findUnique({ where: { key: 'RESEND_API_KEY' } });
    _cachedResendApiKey = config?.value || null;
  } catch (error) {
    logger.warn('Failed to fetch Resend API key from DB, falling back to env', { error: getErrorMessage(error), service: 'email-config' });
    _cachedResendApiKey = null;
  }

  _cachedResendApiKeyAt = now;

  // Fallback to env var
  if (!_cachedResendApiKey) {
    _cachedResendApiKey = process.env.RESEND_API_KEY || null;
  }

  return _cachedResendApiKey;
}

/** Invalidate the cached API key (e.g. after admin updates it) */
export function invalidateResendApiKeyCache(): void {
  _cachedResendApiKey = undefined;
  _cachedResendApiKeyAt = 0;
}

export async function getSharedDomain(): Promise<string> {
  try {
    const config = await db.systemConfig.findUnique({ where: { key: 'SHARED_EMAIL_DOMAIN' } });
    if (config?.value) return config.value;
  } catch (error) {
    logger.warn('Failed to fetch shared domain from DB, falling back to env', { error: getErrorMessage(error), service: 'email-config' });
  }
  return process.env.SHARED_EMAIL_DOMAIN || 'newsletter.nightcrm.app';
}

async function getEmailProvider(): Promise<'resend' | 'smtp' | 'console'> {
  try {
    const config = await db.systemConfig.findUnique({ where: { key: 'EMAIL_PROVIDER' } });
    if (config?.value) return config.value as 'resend' | 'smtp' | 'console';
  } catch (error) {
    logger.warn('Failed to fetch email provider from DB, falling back to env', { error: getErrorMessage(error), service: 'email-config' });
  }
  return (process.env.EMAIL_PROVIDER as 'resend' | 'smtp' | 'console') || 'console';
}

// Resend API calls

async function resendCreateDomain(apiKey: string, domain: string) {
  return fetch(`${RESEND_BASE}/domains`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: domain, region: 'eu' }),
  });
}

async function resendGetDomain(apiKey: string, domainId: string) {
  return fetch(`${RESEND_BASE}/domains/${domainId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

async function resendListDomains(apiKey: string) {
  return fetch(`${RESEND_BASE}/domains`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

// Parse DNS records from Resend API response
function parseDnsRecords(resendRecords: { type: string; name: string; value: string; verified: boolean }[]): DnsRecord[] {
  return resendRecords.map(r => ({
    type: r.type,
    name: r.name,
    value: r.value,
    status: r.verified ? 'verified' as const : 'pending' as const,
  }));
}

/** Extract domain from an email address */
function extractDomain(email: string): string {
  const match = email.match(/@(.+)$/);
  return match ? match[1]! : email;
}

// ─── Public functions ─────────────────────────────────────────

/** Get the full email config status for a workspace */
export async function getWorkspaceEmailConfig(workspaceId: string): Promise<EmailConfigStatus> {
  try {
    const config = await db.workspaceEmailConfig.findUnique({
      where: { workspaceId },
    });

    if (!config) {
      return {
        configured: false,
        provider: await getEmailProvider(),
        fromEmail: null,
        fromName: null,
        domain: null,
        domainStatus: 'none',
        useSharedDomain: false,
        dnsRecords: [],
        creditsRemaining: 100,
        creditsTotal: 100,
        creditsBonus: 0,
      };
    }

    const dnsRecords: DnsRecord[] = config.dnsRecords
      ? (typeof config.dnsRecords === 'string'
          ? JSON.parse(config.dnsRecords)
          : config.dnsRecords)
      : [];

    const total = config.emailCreditsMonthly + config.emailCreditsBonus;
    const remaining = Math.max(0, total - config.emailCreditsUsed);

    return {
      configured: !!(config.fromEmail || config.useSharedDomain),
      provider: await getEmailProvider(),
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      domain: config.domain,
      domainStatus: config.domainStatus as 'none' | 'pending' | 'verified' | 'failed',
      useSharedDomain: config.useSharedDomain,
      dnsRecords,
      creditsRemaining: remaining,
      creditsTotal: total,
      creditsBonus: config.emailCreditsBonus,
    };
  } catch (error) {
    logger.error('[email-config] getWorkspaceEmailConfig error:', error);
    return {
      configured: false,
      provider: 'console',
      fromEmail: null,
      fromName: null,
      domain: null,
      domainStatus: 'none',
      useSharedDomain: false,
      dnsRecords: [],
      creditsRemaining: 0,
      creditsTotal: 0,
      creditsBonus: 0,
    };
  }
}

/** Configure a custom sending email (creates Resend domain) */
export async function configureWorkspaceEmail(
  workspaceId: string,
  fromEmail: string,
  fromName?: string,
): Promise<DomainCreateResult> {
  try {
    const apiKey = await getResendApiKey();
    if (!apiKey) {
      return { success: false, error: 'Resend API key not configured' };
    }

    const domain = extractDomain(fromEmail);

    // Call Resend to create the domain
    const response = await resendCreateDomain(apiKey, domain);

    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: `Resend API error: ${response.status} - ${body}` };
    }

    const data = await response.json();
    const domainId: string = data.id;
    const dnsRecords = parseDnsRecords(data.records || []);

    // Upsert the workspace email config
    await db.workspaceEmailConfig.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        fromEmail,
        fromName: fromName || null,
        resendDomainId: domainId,
        domain,
        domainStatus: 'pending',
        dnsRecords: dnsRecords as any,
        useSharedDomain: false,
      },
      update: {
        fromEmail,
        fromName: fromName || null,
        resendDomainId: domainId,
        domain,
        domainStatus: 'pending',
        dnsRecords: dnsRecords as any,
        useSharedDomain: false,
        verifiedAt: null,
      },
    });

    return { success: true, domainId, dnsRecords };
  } catch (error) {
    logger.error('[email-config] configureWorkspaceEmail error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Verify domain DNS records via Resend */
export async function verifyWorkspaceDomain(workspaceId: string): Promise<DomainVerifyResult> {
  try {
    const config = await db.workspaceEmailConfig.findUnique({
      where: { workspaceId },
    });

    if (!config?.resendDomainId) {
      return { success: false, error: 'No domain configured for this workspace' };
    }

    const apiKey = await getResendApiKey();
    if (!apiKey) {
      return { success: false, error: 'Resend API key not configured' };
    }

    // Call Resend to check domain status
    const response = await resendGetDomain(apiKey, config.resendDomainId);

    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: `Resend API error: ${response.status} - ${body}` };
    }

    const data = await response.json();
    const dnsRecords = parseDnsRecords(data.records || []);

    // Determine status from Resend response
    let status: 'pending' | 'verified' | 'failed' = 'pending';
    if (data.status === 'verified' || data.verified === true) {
      status = 'verified';
    } else if (data.status === 'failed' || data.status === 'not_started') {
      status = data.status === 'failed' ? 'failed' : 'pending';
    }

    // Update the config
    await db.workspaceEmailConfig.update({
      where: { workspaceId },
      data: {
        domainStatus: status,
        dnsRecords: dnsRecords as any,
        verifiedAt: status === 'verified' ? new Date() : config.verifiedAt,
      },
    });

    return { success: true, status, dnsRecords };
  } catch (error) {
    logger.error('[email-config] verifyWorkspaceDomain error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Remove custom domain config (revert to shared) */
export async function removeWorkspaceDomain(workspaceId: string): Promise<void> {
  try {
    const config = await db.workspaceEmailConfig.findUnique({
      where: { workspaceId },
    });

    if (!config) return;

    if (config.resendDomainId) {
      // Optionally delete the Resend domain (best-effort)
      const apiKey = await getResendApiKey();
      if (apiKey) {
        try {
          await fetch(`${RESEND_BASE}/domains/${config.resendDomainId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${apiKey}` },
          });
        } catch (error) {
          logger.warn('Best-effort domain deletion failed', { error: getErrorMessage(error), service: 'email-config', domainId: config.resendDomainId });
        }
      }
    }

    await db.workspaceEmailConfig.update({
      where: { workspaceId },
      data: {
        fromEmail: null,
        fromName: null,
        replyToEmail: null,
        resendDomainId: null,
        domain: null,
        domainStatus: 'none',
        dnsRecords: Prisma.DbNull,
        useSharedDomain: false,
        verifiedAt: null,
      },
    });
  } catch (error) {
    logger.error('[email-config] removeWorkspaceDomain error:', error);
  }
}

/** Enable shared NightCRM domain (zero-config) */
export async function enableSharedDomain(
  workspaceId: string,
  fromName?: string,
): Promise<{ success: boolean; fromEmail: string }> {
  try {
    const sharedDomain = await getSharedDomain();

    // Get workspace slug for the email address
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { slug: true },
    });

    const slug = workspace?.slug || workspaceId;
    const fromEmail = `${slug}@${sharedDomain}`;

    await db.workspaceEmailConfig.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        fromEmail,
        fromName: fromName || null,
        useSharedDomain: true,
        domainStatus: 'none',
      },
      update: {
        fromEmail,
        fromName: fromName || null,
        useSharedDomain: true,
        resendDomainId: null,
        domain: null,
        domainStatus: 'none',
        dnsRecords: Prisma.DbNull,
        verifiedAt: null,
      },
    });

    return { success: true, fromEmail };
  } catch (error) {
    logger.error('[email-config] enableSharedDomain error:', error);
    return { success: false, fromEmail: '' };
  }
}

/** Get the FROM address for sending (respects workspace config) */
export async function getSendingFromAddress(
  workspaceId: string,
): Promise<{ from: string; replyTo?: string }> {
  try {
    const config = await db.workspaceEmailConfig.findUnique({
      where: { workspaceId },
    });

    if (!config?.fromEmail) {
      // Fallback: use shared domain
      const sharedDomain = await getSharedDomain();
      const workspace = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { slug: true, name: true },
      });
      const slug = workspace?.slug || workspaceId;
      const name = workspace?.name || 'NightCRM';
      return { from: `${name} <${slug}@${sharedDomain}>` };
    }

    const displayName = config.fromName || 'NightCRM';
    const from = `${displayName} <${config.fromEmail}>`;
    const replyTo = config.replyToEmail || undefined;

    return { from, replyTo };
  } catch (error) {
    logger.error('[email-config] getSendingFromAddress error:', error);
    return { from: 'NightCRM <noreply@nightcrm.app>' };
  }
}

/** Consume email credits, returns false if insufficient */
export async function consumeEmailCredit(
  workspaceId: string,
): Promise<{ success: boolean; remaining: number; error?: string }> {
  try {
    const config = await db.workspaceEmailConfig.findUnique({
      where: { workspaceId },
    });

    if (!config) {
      return { success: false, remaining: 0, error: 'No email config for workspace' };
    }

    const total = config.emailCreditsMonthly + config.emailCreditsBonus;
    const remaining = total - config.emailCreditsUsed;

    if (remaining <= 0) {
      return { success: false, remaining: 0, error: 'Email credits exhausted' };
    }

    await db.workspaceEmailConfig.update({
      where: { workspaceId },
      data: { emailCreditsUsed: { increment: 1 } },
    });

    return { success: true, remaining: remaining - 1 };
  } catch (error) {
    logger.error('[email-config] consumeEmailCredit error:', error);
    return { success: false, remaining: 0, error: 'Failed to consume credit' };
  }
}

/** Reset monthly credits (called by cron on 1st of month) */
export async function resetMonthlyCredits(workspaceId: string, monthlyQuota: number): Promise<void> {
  try {
    await db.workspaceEmailConfig.update({
      where: { workspaceId },
      data: {
        emailCreditsUsed: 0,
        emailCreditsMonthly: monthlyQuota,
        emailCreditsResetAt: getNextResetDate(),
      },
    });
  } catch (error) {
    logger.error('[email-config] resetMonthlyCredits error:', error);
  }
}

/** Get Resend API status for admin */
export async function getResendStatus(): Promise<{
  apiKeySet: boolean;
  provider: string;
  domainsCount?: number;
}> {
  try {
    const apiKey = await getResendApiKey();
    const provider = await getEmailProvider();

    if (!apiKey || provider !== 'resend') {
      return { apiKeySet: !!apiKey, provider };
    }

    try {
      const response = await resendListDomains(apiKey);
      if (response.ok) {
        const data = await response.json();
        return {
          apiKeySet: true,
          provider,
          domainsCount: data.data?.length ?? 0,
        };
      }
    } catch (error) {
      logger.warn('Resend API status check failed, returning basic status', { error: getErrorMessage(error), service: 'email-config' });
    }

    return { apiKeySet: true, provider };
  } catch (error) {
    logger.error('[email-config] getResendStatus error:', error);
    return { apiKeySet: false, provider: 'console' };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

export function getNextResetDate(): Date {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next;
}
