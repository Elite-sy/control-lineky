/**
 * GET /api/admin/audit-logs
 *   List all audit logs with pagination and filtering.
 *   Supports: ?action=created|updated|deleted|...
 *             ?entityType=contact|deal|workspace|...
 *             ?userId=xxx
 *             ?workspaceId=xxx
 *             ?search=text
 *             ?page=1&limit=50
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { db } from '@lineky/database'

export const dynamic = 'force-dynamic'

export const GET = withAdminAuth(async (req: NextRequest) => {
  const url = req.nextUrl.searchParams
    const actionFilter = url.get('action') || 'all'
    const entityTypeFilter = url.get('entityType') || 'all'
    const userIdFilter = url.get('userId') || ''
    const workspaceId = url.get('workspaceId') || ''
    const search = url.get('search') || ''
    const page = Math.max(1, parseInt(url.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(10, parseInt(url.get('limit') || '50', 10)))
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {}

    if (actionFilter !== 'all') {
      where.action = actionFilter
    }
    if (entityTypeFilter !== 'all') {
      where.entityType = entityTypeFilter
    }
    if (userIdFilter) {
      where.userId = userIdFilter
    }
    if (workspaceId) {
      where.workspaceId = workspaceId
    }
    if (search) {
      where.OR = [
        { entityTitle: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { userId: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ])

    // Summary stats
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [todayCount, weekCount, uniqueUsers, uniqueActions] = await Promise.all([
      db.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
      db.auditLog.count({ where: { createdAt: { gte: weekStart } } }),
      db.auditLog.groupBy({ by: ['userId'], where: { userId: { not: null } } })
        .then((groups) => groups.length),
      db.auditLog.groupBy({ by: ['action'] })
        .then((groups) => groups.length),
    ])

    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        today: todayCount,
        thisWeek: weekCount,
        total,
        uniqueUsers,
        uniqueActions,
      },
    })
}, 'audit:read');
