/**
 * GET /api/admin/system-config
 *
 * Returns platform-level system configuration values.
 * Sensitive values (API keys, passwords) are masked before returning.
 * Reserved for platform administrators.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAdminAuth } from '@lineky/platform-auth/admin-guard';
import { db } from '@lineky/database';
import { invalidateResendApiKeyCache } from '@/services/email-config';
import { logger } from '@/lib/logger';
import { logAdminAction } from '@lineky/platform-auth/audit/admin';

export const dynamic = 'force-dynamic';

/** Allowlist of valid system config keys */
const ALLOWED_KEYS = new Set([
  'RESEND_API_KEY',
  'SHARED_EMAIL_DOMAIN',
  'EMAIL_PROVIDER',
  'EMAIL_FROM',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
]);


export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
      const url = new URL(req.url);
      const keysParam = url.searchParams.get('keys');
      const keys = keysParam ? keysParam.split(',') : [];

      const where = keys.length > 0 ? { key: { in: keys } } : {};

      const configs = await db.systemConfig.findMany({
        where,
        select: {
          key: true,
          value: true,
          isSensitive: true,
          updatedAt: true,
        },
      });

      const configMap: Record<string, string | null> = {};
      for (const c of configs) {
        // Mask sensitive values before returning to frontend
        configMap[c.key] = c.isSensitive ? null : c.value;
      }

      // Derive admin email config shape
      const resendApiKey = configMap['RESEND_API_KEY'] ?? null;
      const sharedDomain = configMap['SHARED_EMAIL_DOMAIN'] ?? 'newsletter.nightcrm.app';

      // Count domains configured (workspaces with custom domain verified)
      const configuredDomainCount = await db.workspaceEmailConfig.count({
        where: { domainStatus: 'verified', useSharedDomain: false },
      });

      return NextResponse.json({
        resendApiKey: resendApiKey, // always null (masked) — resendApiKeySet indicates presence
        resendApiKeySet: configs.some(c => c.key === 'RESEND_API_KEY' && c.value),
        sharedDomain,
        configuredDomainCount,
        resendStatus: configs.some(c => c.key === 'RESEND_API_KEY' && c.value) ? 'connected' : 'disconnected',
      });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[Admin SystemConfig] GET error:', message);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}, 'system-config:read');

/**
 * PUT /api/admin/system-config
 *
 * Updates platform-level system configuration values.
 * Restricted to a known allowlist of config keys.
 * Reserved for platform administrators.
 */
export const PUT = withAdminAuth(async (req: NextRequest, context) => {
  try {
      const body = await req.json();
      const { configs } = body as { configs: Array<{ key: string; value: string; isSensitive?: boolean }> };

      if (!Array.isArray(configs) || configs.length === 0) {
        return NextResponse.json(
          { error: 'Au moins une configuration est requise' },
          { status: 400 },
        );
      }

      let updatedCount = 0;
      for (const config of configs) {
        const { key, value, isSensitive } = config;
        if (!key || typeof key !== 'string') continue;

        // Enforce allowlist — reject unknown config keys
        if (!ALLOWED_KEYS.has(key)) {
          logger.warn(`[Admin SystemConfig] Blocked unknown key: ${key}`);
          continue;
        }

        await db.systemConfig.upsert({
          where: { key },
          create: {
            key,
            value: value ?? '',
            isSensitive: isSensitive ?? false,
          },
          update: {
            value: value ?? '',
            isSensitive: isSensitive ?? false,
          },
        });

        // Invalidate caches when email-related keys change
        if (key === 'RESEND_API_KEY') {
          invalidateResendApiKeyCache();
        }

        updatedCount++;
      }

      await logAdminAction({
        action: 'update_system_config',
        entityType: 'system_config',
        entityId: 'system_config',
        entityTitle: 'System Configuration',
        actorEmail: context?.adminEmail || 'system',
        details: { 
          updatedKeys: configs.filter(c => ALLOWED_KEYS.has(c.key)).map(c => c.key),
          updatedCount 
        },
      });

      return NextResponse.json({ success: true, updated: updatedCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[Admin SystemConfig] PUT error:', message);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}, 'system-config:write');
