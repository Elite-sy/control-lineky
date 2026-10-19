// Helper for admin routes to log audit entries with explicit actor

import { db } from '@lineky/database';
import { headers } from 'next/headers';

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

/**
 * Log an audit entry from an admin route with explicit actor information.
 * Unlike the base logAction, this helper extracts IP and user agent from the request
 * and requires the caller to pass the actor email explicitly (since admin routes
 * don't have x-user-email headers set by middleware).
 * 
 * Sensitive data (passwords, tokens, secrets) are automatically redacted before storage.
 * 
 * This function never throws — if headers() is unavailable (tests, scripts, background jobs)
 * or the audit write fails, it logs a warning and returns normally.
 */
export async function logAdminAction(params: {
  action: string;
  entityType: string;
  entityId?: string | null;
  entityTitle?: string | null;
  actorEmail: string;
  workspaceId?: string | null;
  details?: Record<string, unknown> | null;
}) {
  try {
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null;
    const userAgent = headersList.get('user-agent') || null;

    // Sanitize details to remove sensitive data
    const sanitizedDetails = params.details 
      ? sanitizeAuditDetails(params.details) 
      : null;

    await db.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        entityTitle: params.entityTitle || null,
        userId: params.actorEmail,
        workspaceId: params.workspaceId || null,
        details: sanitizedDetails as any || null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.warn('[logAdminAction] Failed to log audit entry:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Log a permission denial from an admin route.
 * 
 * This function never throws — if headers() is unavailable or the audit write fails,
 * it logs a warning and returns normally.
 */
export async function logAdminDenial(params: {
  actorEmail: string;
  route: string;
  permission: string;
  details?: Record<string, unknown> | null;
}) {
  try {
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null;
    const userAgent = headersList.get('user-agent') || null;

    await db.auditLog.create({
      data: {
        action: 'denied',
        entityType: 'admin_permission',
        entityId: null,
        entityTitle: null,
        userId: params.actorEmail,
        workspaceId: null,
        details: {
          route: params.route,
          permission: params.permission,
          ...params.details,
        } as any,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.warn('[logAdminDenial] Failed to log audit denial:', error instanceof Error ? error.message : String(error));
  }
}
