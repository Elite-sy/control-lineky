/**
 * Audit Trail service — log + query
 *
 * Usage in other services (fire-and-forget, no .catch() needed):
 *   logAction({ action: 'created', entityType: 'contact', entityId: '...', entityTitle: '...' });
 *
 * userId, ipAddress and userAgent are automatically filled from AuditCtx
 * (set by the route handler via setAuditCtx(req)).
 * 
 * P0-008 Fix: Sensitive data sanitization — passwords, tokens, and secrets
 * are automatically redacted before storage.
 */

import { db } from '@lineky/database';
import { getPagination, paginatedResult, mapError } from './base';
import { getAuditCtx } from '@/lib/audit-context';
import { logger } from '@/lib/logger';

// ─── Sensitive Field Detection ─────────────────────────────────────────

/**
 * Sensitive field names that should be redacted in audit logs.
 * Matches field names case-insensitively.
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'privatekey',
  'private_key',
  'clientsecret',
  'client_secret',
  'auth',
  'authorization',
  'credential',
  'credentials',
  'ssn',
  'socialsecuritynumber',
  'creditcard',
  'credit_card',
  'cvv',
  'pin',
  'otp',
  'mfa',
  'totpsecret',
  'totp_secret',
]);

/**
 * Sanitize audit log details by redacting sensitive fields.
 * Recursively processes nested objects and arrays.
 * 
 * @param details - The details object to sanitize
 * @returns Sanitized copy of the details object
 */
function sanitizeAuditDetails(details: unknown): unknown {
  if (details === null || details === undefined) {
    return details;
  }

  // Handle arrays recursively
  if (Array.isArray(details)) {
    return details.map(item => sanitizeAuditDetails(item));
  }

  // Handle objects
  if (typeof details === 'object') {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(details)) {
      const keyLower = key.toLowerCase().replace(/[_-]/g, '');
      
      // Redact sensitive fields
      if (SENSITIVE_FIELDS.has(keyLower)) {
        sanitized[key] = '[REDACTED]';
      } else {
        // Recursively sanitize nested objects/arrays
        sanitized[key] = sanitizeAuditDetails(value);
      }
    }
    
    return sanitized;
  }

  // Primitive values pass through
  return details;
}

// ─── Types ─────────────────────────────────────────────────────────────

export interface LogActionParams {
  action: string;
  entityType: string;
  entityId?: string | null;
  entityTitle?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditListParams {
  page?: number;
  pageSize?: number;
  entityType?: string;
  action?: string;
  userId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Log action (fire-and-forget) ──────────────────────────────────────

/**
 * Write a single audit log entry. Fire-and-forget: never throws.
 * userId, ipAddress, userAgent are auto-filled from request context
 * (set via setAuditCtx in route handlers), but can be overridden via params.
 */
export async function logAction(params: LogActionParams) {
  try {
    const ctx = getAuditCtx();
    
    // Sanitize details to remove sensitive data (P0-008)
    const sanitizedDetails = params.details 
      ? sanitizeAuditDetails(params.details) 
      : undefined;
    
    await db.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        entityTitle: params.entityTitle || null,
        userId: params.userId ?? ctx.userId ?? null,
        workspaceId: params.workspaceId ?? null,
        details: sanitizedDetails as any ?? undefined,
        ipAddress: params.ipAddress ?? ctx.ipAddress ?? null,
        userAgent: params.userAgent ?? ctx.userAgent ?? null,
      },
    });
  } catch (error) {
    // Never throw — audit logging must not break business logic
    logger.error('[Audit] logAction error:', error);
  }
}

// ─── List (paginated with filters) ─────────────────────────────────────

export async function listAuditLogs(params: AuditListParams) {
  const { page, pageSize, skip, take } = getPagination({
    page: params.page,
    pageSize: params.pageSize,
  });

  const where: Record<string, unknown> = {};

  // Workspace filtering — restrict to current workspace
  // Note: AuditLog doesn't have workspaceId field yet (legacy),
  // but we still apply the pattern for future migration.
  // Currently all users see all logs within their workspace context.

  if (params.entityType) where.entityType = params.entityType;
  if (params.action) where.action = params.action;
  if (params.userId) where.userId = params.userId;

  if (params.search) {
    where.OR = [
      { entityTitle: { contains: params.search, mode: 'insensitive' } },
      { userId: { contains: params.search, mode: 'insensitive' } },
      { action: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  if (params.dateFrom || params.dateTo) {
    const createdAt: Record<string, unknown> = {};
    if (params.dateFrom) createdAt.gte = new Date(params.dateFrom);
    if (params.dateTo) createdAt.lte = new Date(params.dateTo);
    where.createdAt = createdAt;
  }

  const effectiveWhere = Object.keys(where).length > 0 ? where : undefined;

  const [data, total] = await Promise.all([
    db.auditLog.findMany({
      where: effectiveWhere,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    db.auditLog.count({ where: effectiveWhere }),
  ]);

  return paginatedResult(data, total, page, pageSize);
}

// ─── Get by ID ─────────────────────────────────────────────────────────

export async function getAuditLog(id: string) {
  try {
    const log = await db.auditLog.findUnique({ where: { id } });
    if (!log) throw { code: 'P2025' };
    return log;
  } catch (error) {
    throw mapError(error, 'audit');
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────

export async function getAuditStats() {
  // Workspace filtering placeholder (future: add workspaceId to AuditLog model)

  const [
    total,
    byEntityType,
    byAction,
    last24h,
    last7d,
    topUsers,
    lastActivity,
  ] = await Promise.all([
    db.auditLog.count(),

    db.auditLog.groupBy({
      by: ['entityType'],
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    }),

    db.auditLog.groupBy({
      by: ['action'],
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    }),

    db.auditLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),

    db.auditLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),

    db.auditLog.groupBy({
      by: ['userId'],
      where: { userId: { not: null } },
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),

    // Latest activity timestamp
    db.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  return {
    total,
    last24h,
    last7d,
    byEntityType: byEntityType.map(g => ({ entityType: g.entityType, count: g._count })),
    byAction: byAction.map(g => ({ action: g.action, count: g._count })),
    topUsers: topUsers.map(g => ({ userId: g.userId, count: g._count })),
    lastActivity: lastActivity?.createdAt || null,
  };
}