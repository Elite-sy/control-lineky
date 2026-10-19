/**
 * workspace-context.ts — AsyncLocalStorage pour le contexte workspace
 *
 * Ce module stocke le workspaceId actif pour la requête en cours.
 * Il est initialisé par `setAuditCtx()` (audit-context.ts) ou `withApiAuth()` (api-auth.ts).
 *
 * La résolution du workspace (DB lookup User → WorkspaceMember → Workspace)
 * est LAZY : elle ne se produit qu'au premier appel à `ensureWorkspaceCtx()`
 * ou `getActiveWorkspaceId()`. Le résultat est mis en cache pour la durée de la requête.
 *
 * Chaîne d'initialisation :
 *   1. `db.ts` initialise le PrismaClient et appelle `_setBaseClientGetter(() => db)`
 *   2. `withApiAuth()` ou `setAuditCtx()` appellent `initWorkspaceCtx(authUserId, email)`
 *   3. Au premier accès, `ensureWorkspaceCtx()` résout via DB : User → WorkspaceMember → Workspace
 *
 * MODE LEGACY : Si l'utilisateur n'a pas de User/WorkspaceMember en base,
 * workspaceId reste null → aucun filtre appliqué (compatibilité mono-utilisateur).
 *
 * Tables requises (migration 20250722120000) :
 *   - User (authUserId, email, memberships)
 *   - WorkspaceMember (userId, workspaceId, role, workspace.isActive)
 *   - Workspace (id, isActive)
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from '@/lib/logger';

// ─── Types ─────────────────────────────────────────────────────────────

export interface WorkspaceCtx {
  /** Workspace ID résolu, ou null si legacy mode */
  workspaceId: string | null;
  /** Supabase Auth user UUID (prioritaire pour la résolution) */
  authUserId: string | null;
  /** Email de l'utilisateur (fallback pour la résolution) */
  authUserEmail: string | null;
  /** True si la résolution a été effectuée (même si workspaceId est null) */
  resolved: boolean;
  /** Promise de résolution en cours (pour éviter les résolutions parallèles intra-requête) */
  _resolvePromise?: Promise<void>;
}

// ─── Store ─────────────────────────────────────────────────────────────

const wsStore = new AsyncLocalStorage<WorkspaceCtx>();

/** Lit le contexte workspace courant (peut ne pas être résolu) */
export function getWorkspaceCtx(): WorkspaceCtx | undefined {
  return wsStore.getStore();
}

/**
 * Initialise le contexte workspace pour la requête courante.
 * Appelé par setAuditCtx() et withApiAuth() — NE PAS appeler directement.
 * La résolution effective (DB lookup) est différée au premier accès.
 *
 * @param authUserId - Supabase Auth UUID (prioritaire)
 * @param authUserEmail - Email (fallback)
 */
export function initWorkspaceCtx(authUserId: string | null, authUserEmail?: string | null): void {
  wsStore.enterWith({
    workspaceId: null,
    authUserId,
    authUserEmail: authUserEmail ?? null,
    resolved: false,
  });
}

// ─── Lazy DB resolution ───────────────────────────────────────────────

/** Référence au client Prisma de base (injectée par db.ts pour éviter circular deps) */
let _getBaseClient: (() => any) | null = null;

/**
 * Injectée par db.ts au démarrage pour fournir le client Prisma de base.
 * Évite la dépendance circulaire : db.ts → workspace-context → db.ts
 *
 * ⚠️ Ne pas appeler manuellement — db.ts s'en charge automatiquement.
 */
export function _setBaseClientGetter(getter: () => any): void {
  _getBaseClient = getter;
}

/**
 * Résout le workspace de l'utilisateur courant (lazy, une fois par requête).
 *
 * Stratégie de résolution (par ordre de priorité) :
 * 1. Si déjà résolu → retourne immédiatement (cache intra-requête)
 * 2. Si résolution en cours → attend la même promise (évite les DB calls parallèles)
 * 3. Sinon → lookup DB via authUserId (prioritaire) ou email (fallback)
 * 4. En cas d'erreur → legacy mode (workspaceId = null, aucun filtre)
 *
 * P0 Étape 2 : authUserId est maintenant le moyen principal de résolution.
 * L'email sert de fallback pour les routes qui utilisent setAuditCtx (middleware).
 */
export async function ensureWorkspaceCtx(): Promise<WorkspaceCtx> {
  const ctx = wsStore.getStore();

  if (!ctx) {
    // Pas de contexte (scripts, tests, etc.) → legacy mode
    return { workspaceId: null, authUserId: null, authUserEmail: null, resolved: true };
  }

  if (ctx.resolved) return ctx;

  // Si une résolution est déjà en cours dans cette requête, on l'attend
  if (ctx._resolvePromise) {
    await ctx._resolvePromise;
    return wsStore.getStore()!;
  }

  // Démarrer la résolution
  ctx._resolvePromise = (async () => {
    try {
      if (!_getBaseClient) {
        // Client non injecté → legacy
        ctx.workspaceId = null;
      } else {
        const baseClient = _getBaseClient();
        let resolvedId: string | null = null;

        // ── Stratégie 1 : résolution par authUserId (prioritaire) ──
        if (ctx.authUserId) {
          const user = await baseClient.user.findUnique({
            where: { authUserId: ctx.authUserId },
            select: {
              memberships: {
                where: { workspace: { isActive: true } },
                select: { workspaceId: true },
                orderBy: { joinedAt: 'asc' },
                take: 1,
              },
            },
          });
          resolvedId = user?.memberships?.[0]?.workspaceId ?? null;
        }

        // ── Stratégie 2 : fallback par email (pour setAuditCtx legacy) ──
        if (!resolvedId && ctx.authUserEmail && ctx.authUserEmail !== '' && ctx.authUserEmail !== 'local-admin') {
          const user = await baseClient.user.findUnique({
            where: { email: ctx.authUserEmail },
            select: {
              memberships: {
                where: { workspace: { isActive: true } },
                select: { workspaceId: true },
                orderBy: { joinedAt: 'asc' },
                take: 1,
              },
            },
          });
          resolvedId = user?.memberships?.[0]?.workspaceId ?? null;
        }

        ctx.workspaceId = resolvedId;
      }
    } catch (e) {
      // Table User inexistante, DB indisponible, etc. → legacy mode
      // Ne pas loguer en production pour éviter le spam
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('[workspace-context] Resolution échouée, mode legacy:', (e as Error)?.message);
      }
      ctx.workspaceId = null;
    } finally {
      ctx.resolved = true;
      ctx._resolvePromise = undefined;
    }
  })();

  await ctx._resolvePromise;
  return wsStore.getStore()!;
}

// ─── Convenience helpers ──────────────────────────────────────────────

/**
 * Résout et retourne uniquement le workspaceId actif.
 * Shortcut pour `ensureWorkspaceCtx().then(ctx => ctx.workspaceId)`.
 *
 * @returns workspaceId string, ou null si legacy mode / pas de workspace
 *
 * @example
 *   // Dans une route API qui filtre par workspace :
 *   const workspaceId = await getActiveWorkspaceId();
 *   const contacts = await db.contact.findMany();
 */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const ctx = await ensureWorkspaceCtx();
  return ctx.workspaceId;
}