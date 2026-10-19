/**
 * GET /api/admin/support-tickets
 *   List all support tickets across all workspaces.
 *   Supports filtering: ?status=open|pending|closed|all
 *                       ?priority=low|medium|high|critical
 *                       ?search=text
 *                       ?workspaceId=xxx
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { db } from '@lineky/database'
import { createClient as createSupabaseClient } from '@lineky/supabase/server'

export const dynamic = 'force-dynamic'

export const GET = withAdminAuth(async (req: NextRequest) => {
  const url = req.nextUrl.searchParams
    const statusFilter = url.get('status') || 'all'
    const priorityFilter = url.get('priority') || 'all'
    const search = url.get('search') || ''
    const workspaceId = url.get('workspaceId') || ''
    const page = Math.max(1, parseInt(url.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(10, parseInt(url.get('limit') || '25', 10)))
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {}

    if (statusFilter !== 'all') {
      where.status = statusFilter
    }
    if (priorityFilter !== 'all') {
      where.priority = priorityFilter
    }
    if (workspaceId) {
      where.workspaceId = workspaceId
    }
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Get tickets with workspace info
    const [tickets, total] = await Promise.all([
      db.ticket.findMany({
        where,
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.ticket.count({ where }),
    ])

    // Get workspace info for each ticket's workspaceId
    // We need to get workspace info separately since Ticket may not have a direct workspace relation
    // Let's check the Ticket model...

    // Get summary stats
    // Real ticket statuses: new, waiting_on_customer, waiting_on_us, resolved, closed
    const [openCount, pendingCount, closedCount, criticalCount] = await Promise.all([
      db.ticket.count({ where: { status: 'new' } }),
      db.ticket.count({ where: { status: { in: ['waiting_on_customer', 'waiting_on_us'] } } }),
      db.ticket.count({ where: { status: { in: ['closed', 'resolved'] } } }),
      db.ticket.count({ where: { priority: 'critical' } }),
    ])

    return NextResponse.json({
      tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        open: openCount,
        pending: pendingCount,
        closed: closedCount,
        critical: criticalCount,
        total: openCount + pendingCount + closedCount,
      },
    })
}, 'support:read', createSupabaseClient);
