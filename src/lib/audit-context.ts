/**
 * Audit Context — AsyncLocalStorage-based request context.
 *
 * The middleware sets `x-user-email` and `x-user-id` (P0 Étape 2) on request headers.
 * Each CRM route handler calls `setAuditCtx(req)` as its first line.
 * `logAction()` in services/audit.ts automatically reads from this context.
 *
 * P0: setAuditCtx also initializes the workspace context (workspace-context.ts)
 * so that the db.ts Prisma extension can lazily resolve and inject workspaceId.
 *
 * P0 Étape 2: passes both authUserId (from x-user-id) and email to workspace context
 * for proper workspace resolution.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { initWorkspaceCtx } from '@/lib/workspace-context';

export interface AuditCtx {
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

const store = new AsyncLocalStorage<AuditCtx>();

/**
 * Call at the top of every CRM API route handler.
 * Reads user email (set by middleware), IP, and User-Agent from the request.
 * Also initializes the workspace context for automatic workspaceId filtering.
 *
 * P0 Étape 2: also reads `x-user-id` header (Supabase Auth UUID)
 * to pass to workspace context for authUserId-based resolution.
 */
export function setAuditCtx(req: Request): void {
  const userEmail = req.headers.get('x-user-email');
  const userId = req.headers.get('x-user-id'); // P0 Étape 2: Supabase Auth UUID
  store.enterWith({
    userId: userEmail,
    ipAddress:
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null,
    userAgent: req.headers.get('user-agent') || null,
  });

  // Initialize workspace context for the db.ts extension
  // P0 Étape 2: pass authUserId (priority) + email (fallback)
  initWorkspaceCtx(userId, userEmail);
}

/**
 * Called internally by `logAction()` — no need to call this directly from services.
 */
export function getAuditCtx(): AuditCtx {
  return store.getStore() ?? { userId: null, ipAddress: null, userAgent: null };
}