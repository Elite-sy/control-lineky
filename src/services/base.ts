/**
 * Base CRUD service — generic helpers used by all entity services.
 * Centralizes: pagination, error mapping (P2025→404, P2002→409),
 *               search (OR contains), and the standard try/catch pattern.
 */

import { getActiveWorkspaceId } from '@/lib/workspace-context';

// ─── Types ─────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ServiceError {
  status: number;
  message: string;
}

// ─── Error mapping ─────────────────────────────────────────────────────

const ENTITY_LABELS: Record<string, string> = {
  contact: 'Contact',
  company: 'Entreprise',
  deal: 'Deal',
  task: 'Tâche',
  ticket: 'Ticket',
  call: 'Appel',
  invoice: 'Facture',
  product: 'Produit',
  conversation: 'Conversation',
  savedView: 'Vue',
  taskQueue: 'File',
  automation: 'Automatisation',
  activity: 'Activité',
  email: 'E-mail',
  message: 'Message',
  payment: 'Paiement',
  customField: 'Champ personnalisé',
  customFieldValue: 'Valeur personnalisée',
  notification: 'Notification',
  pipeline: 'Pipeline',
  pipelineStage: 'Étape de pipeline',
  audit: 'Journal d\'audit',
  milestone: 'Jalon',
  photo: 'Photo',
  quote: 'Devis',
  quoteLineItem: 'Ligne de devis',
  knowledgeBaseArticle: 'Article',
};

export function mapError(error: unknown, entity = 'Ressource'): ServiceError {
  const label = ENTITY_LABELS[entity] || entity;
  const anyErr = error as { code?: string; message?: string };

  if (anyErr.code === 'P2025') {
    return { status: 404, message: `${label} non trouvé(e)` };
  }
  if (anyErr.code === 'P2002') {
    return { status: 409, message: `${label} existe déjà (conflit d'unicité)` };
  }
  if (anyErr.code === 'P2003') {
    return { status: 400, message: `Référence invalide pour ${label.toLowerCase()}` };
  }
  if (anyErr.code === 'P2021') {
    return { status: 500, message: 'Erreur de connexion à la base de données' };
  }

  return { status: 500, message: 'Erreur serveur' };
}

// ─── Pagination helper ────────────────────────────────────────────────

export function getPagination(params: PaginationParams) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, Math.min(200, params.pageSize || params.limit || 50));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginatedResult<T>(data: T[], total: number, page: number, pageSize: number): PaginatedResult<T> {
  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ─── Current user helper ─────────────────────────────────────────────

/**
 * Get the current user ID from the audit context (set by setAuditCtx in route handlers).
 * Falls back to null if no request context is available.
 */
export function getCurrentUserId(): string | null {
  try {
    // Dynamic import to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuditCtx } = require('@/lib/audit-context');
    return getAuditCtx().userId;
  } catch {
    return null;
  }
}

// ─── Created-by helper ────────────────────────────────────────────────

/**
 * Inject `createdBy` (current user ID from audit context) into a data object.
 * Useful for services that need to record who created a record.
 */
export function withCreatedBy<T extends object>(data: T): T & { createdBy: string } {
  return { ...data, createdBy: getCurrentUserId() || 'system' } as T & { createdBy: string };
}

// ─── Search helper ─────────────────────────────────────────────────────

/**
 * Build an OR clause for Prisma `where` that searches across the given fields using `contains` (case-insensitive).
 */
export function buildSearch(fields: string[], query: string): Record<string, unknown> | undefined {
  if (!query) return undefined;
  const filters = fields.map(f => ({ [f]: { contains: query, mode: 'insensitive' as const } }));
  return { OR: filters };
}

// ─── Relation search helper ────────────────────────────────────────────

/**
 * Build a relation-level OR search. Example: searching tasks by contact name.
 * Usage: { contact: buildRelationSearch(['firstName', 'lastName'], query) }
 */
export function buildRelationSearch(fields: string[], query: string): Record<string, unknown> | undefined {
  if (!query) return undefined;
  const filters = fields.map(f => ({ [f]: { contains: query, mode: 'insensitive' as const } }));
  return { OR: filters };
}

// ─── Where builder ─────────────────────────────────────────────────────

/**
 * Safely build a `where` clause. Only includes keys that have truthy values.
 */
export function buildWhere(filters: Record<string, unknown>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      where[key] = value;
    }
  }
  return where;
}

// ─── Re-usable Prisma include/select templates ────────────────────────

export const INCLUDES = {
  contact: {
    summary: { select: { firstName: true, lastName: true, id: true } },
    full: { select: { firstName: true, lastName: true, email: true, id: true, phone: true, jobTitle: true } },
    withCompany: { select: { firstName: true, lastName: true, id: true, phone: true, jobTitle: true, company: { select: { name: true } } } },
  },
  company: {
    summary: { select: { name: true, id: true } },
    full: { select: { name: true, id: true, industry: true, website: true } },
  },
  deal: {
    summary: { select: { id: true, title: true } },
  },
  queue: {
    summary: { select: { id: true, name: true } },
  },
} as const;

// ─── Bulk operations (generic) ────────────────────────────────────────

/**
 * Generic bulk delete using Prisma `deleteMany`.
 * WARNING: Prefer `bulkSoftDelete` for user-facing entities.
 * Only use this for non-soft-delete models (e.g. custom field values, logs).
 * @param model - Prisma delegate (e.g. db.contact)
 * @param ids - Array of record IDs to hard-delete
 * @param entity - Entity name for error mapping
 */
export async function bulkDelete(
  model: { deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<{ count: number }> },
  ids: string[],
  _entity?: string,
): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 };
  const MAX_BULK = 200;
  let totalDeleted = 0;

  for (let i = 0; i < ids.length; i += MAX_BULK) {
    const batch = ids.slice(i, i + MAX_BULK);
    const result = await model.deleteMany({ where: { id: { in: batch } } });
    totalDeleted += result.count;
  }

  return { deleted: totalDeleted };
}

/**
 * Generic bulk update using Prisma `updateMany`.
 * @param model - Prisma delegate (e.g. db.contact)
 * @param ids - Array of record IDs to update
 * @param data - Fields to update on all matching records
 */
export async function bulkUpdate(
  model: { updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }> },
  ids: string[],
  data: Record<string, unknown>,
  workspaceId?: string,
): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 };
  const MAX_BULK = 200;
  let totalUpdated = 0;

  for (let i = 0; i < ids.length; i += MAX_BULK) {
    const batch = ids.slice(i, i + MAX_BULK);
    const where: Record<string, unknown> = { id: { in: batch } };
    if (workspaceId) where.workspaceId = workspaceId;
    const result = await model.updateMany({
      where,
      data,
    });
    totalUpdated += result.count;
  }

  return { updated: totalUpdated };
}

// ─── Workspace Isolation Helpers ─────────────────────────────────────
// Phase 3.4: Workspace isolation — filter all queries by workspaceId.
// Uses getActiveWorkspaceId() from workspace-context (AsyncLocalStorage).
// Returns {} in legacy mode (no workspace → no filter → backward compatible).

/**
 * Returns a workspace filter object for Prisma `where` clauses.
 * If workspaceId is available, returns `{ workspaceId: "..." }`.
 * Otherwise returns `{}` (legacy mode — no filtering).
 *
 * Includes deletedAt: null by default (soft-delete pattern).
 * Pass { softDelete: false } to skip deletedAt for models without it
 * (e.g. Notification, EmailReply).
 *
 * @example
 *   const ws = await wsFilter();
 *   const contacts = await db.contact.findMany({ where: { ...ws, stage: 'lead' } });
 *
 *   // For models without deletedAt field:
 *   const ws = await wsFilter({ softDelete: false });
 */
export async function wsFilter(opts?: { softDelete?: boolean }): Promise<Record<string, unknown>> {
  const workspaceId = await getActiveWorkspaceId();
  const skipDeletedAt = opts?.softDelete === false;
  if (workspaceId) return skipDeletedAt ? { workspaceId } : { workspaceId, deletedAt: null };
  return skipDeletedAt ? {} : { deletedAt: null };
}

/**
 * Merges workspace filter into an existing where clause.
 * Preserves all existing filters and adds workspaceId if available.
 *
 * @example
 *   const where = { status: 'active' };
 *   const effectiveWhere = await withWsFilter(where);
 */
export async function withWsFilter<T extends object>(
  where: T = {} as T,
): Promise<T & { workspaceId?: string }> {
  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) return where as T & { workspaceId?: string };
  return { ...where, workspaceId } as T & { workspaceId?: string };
}

/**
 * Adds workspaceId to data for create operations.
 * Preserves all existing data fields and injects workspaceId.
 *
 * @example
 *   const data = { firstName: 'John', email: 'john@example.com' };
 *   const dataWithWs = await withWsData(data);
 *   await db.contact.create({ data: dataWithWs });
 */
export async function withWsData<T extends object>(
  data: T,
): Promise<T & { workspaceId?: string }> {
  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) return data as T & { workspaceId?: string };
  return { ...data, workspaceId } as T & { workspaceId?: string };
}

// ─── Soft Delete Helpers ──────────────────────────────────────────────
// Phase: Soft Delete actif — `deletedAt` field based soft delete/restore.

/**
 * Soft-delete a single record by setting `deletedAt` to now.
 * @param model - Prisma delegate with `updateMany`
 * @param id - Record ID to soft-delete
 */
export async function softDelete(
  model: { updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }> },
  id: string,
  workspaceId?: string,
): Promise<void> {
  const where: Record<string, unknown> = { id };
  if (workspaceId) where.workspaceId = workspaceId;
  await model.updateMany({
    where,
    data: { deletedAt: new Date() },
  });
}

/**
 * Soft-delete multiple records by setting `deletedAt` to now.
 * @param model - Prisma delegate with `updateMany`
 * @param ids - Record IDs to soft-delete
 * @returns Number of records soft-deleted
 */
export async function bulkSoftDelete(
  model: { updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }> },
  ids: string[],
  workspaceId?: string,
): Promise<number> {
  if (ids.length === 0) return 0;
  let total = 0;
  const BATCH = 200;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const where: Record<string, unknown> = { id: { in: batch } };
    if (workspaceId) where.workspaceId = workspaceId;
    const result = await model.updateMany({
      where,
      data: { deletedAt: new Date() },
    });
    total += result.count;
  }
  return total;
}

/**
 * Restore soft-deleted records by setting `deletedAt` to null.
 * @param model - Prisma delegate with `updateMany`
 * @param ids - Record IDs to restore
 * @returns Number of records restored
 */
 
export async function restoreRecords(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  ids: string[],
  workspaceId?: string,
): Promise<number> {
  if (ids.length === 0) return 0;
  const where: Record<string, unknown> = { id: { in: ids }, deletedAt: { not: null } };
  if (workspaceId) where.workspaceId = workspaceId;
  const result = await model.updateMany({
    where,
    data: { deletedAt: null },
  });
  return result.count;
}

/**
 * Permanently delete (hard delete) soft-deleted records.
 * @param model - Prisma delegate with `deleteMany`
 * @param ids - Record IDs to permanently delete
 * @returns Number of records permanently deleted
 */
 
export async function permanentDelete(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  ids: string[],
  workspaceId?: string,
): Promise<number> {
  if (ids.length === 0) return 0;
  const where: Record<string, unknown> = { id: { in: ids }, deletedAt: { not: null } };
  if (workspaceId) where.workspaceId = workspaceId;
  const result = await model.deleteMany({
    where,
  });
  return result.count;
}

/**
 * Count soft-deleted records for a given model and workspace.
 * @param model - Prisma delegate with `count`
 * @param extraWhere - Additional where clause filters
 */
 
export async function countTrashed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  extraWhere: Record<string, unknown> = {},
): Promise<number> {
  const ws = await wsFilter();
  // Override deletedAt filter to find ONLY deleted records
  const { deletedAt: _, ...wsWithoutDeleted } = ws;
  return model.count({
    where: { ...wsWithoutDeleted, deletedAt: { not: null }, ...extraWhere },
  });
}

/**
 * List soft-deleted records with pagination.
 * @param model - Prisma delegate with `findMany` and `count`
 * @param options - include, orderBy, extraWhere, pagination
 */
 
export async function listTrashed<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  options: {
    include?: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    extraWhere?: Record<string, unknown>;
    page?: number;
    limit?: number;
  } = {},
): Promise<{ data: T[]; total: number; page: number; limit: number }> {
  const { page = 1, limit = 50, include, orderBy, extraWhere } = options;
  const ws = await wsFilter();
  const { deletedAt: _, ...wsWithoutDeleted } = ws;
  const where = { ...wsWithoutDeleted, deletedAt: { not: null }, ...extraWhere };

  const [data, total] = await Promise.all([
    model.findMany({
      where,
      include,
      orderBy: orderBy || { deletedAt: 'desc' as const },
      skip: (page - 1) * limit,
      take: limit,
    }),
    model.count({ where }),
  ]);

  return { data: data as T[], total, page, limit };
}