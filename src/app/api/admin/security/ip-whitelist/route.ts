/**
 * GET /api/admin/security/ip-whitelist
 *   Get current admin's IP whitelist configuration
 *
 * PATCH /api/admin/security/ip-whitelist
 *   Update IP whitelist for current admin or specified admin
 *   Body: { adminId?, allowedIps: string[] | null }
 *   null clears the whitelist (allow all IPs)
 * 
 *   Special permission logic: modifying another admin's allowlist requires
 *   super_admin role (security:write permission alone is not sufficient).
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { db } from '@lineky/database'
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic'

export const GET = withAdminAuth(async (req: NextRequest) => {
  // Get all admins with IP whitelist info
  let admins: Array<Record<string, unknown>> = []
  try {
    admins = await db.platformAdmin.findMany({
      where: { allowedIps: { not: null } },
      select: { id: true, email: true, allowedIps: true },
    })
  } catch {
    // Table doesn't exist
  }

  // Also get the requesting user's current IP
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  return NextResponse.json({
    admins: admins.map(a => ({
      ...a,
      allowedIps: a.allowedIps ? JSON.parse(a.allowedIps as string) : [],
    })),
    currentIp: clientIp,
  })
}, 'security:read');

export const PATCH = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const body = await req.json()
    const { adminId, allowedIps } = body

    const callerEmail = context?.adminEmail || ''
    const callerRole = context?.adminRole || ''

    // Determine target email
    let targetEmail = callerEmail

    if (adminId) {
      const targetAdmin = await db.platformAdmin.findUnique({ where: { id: adminId } })
      if (!targetAdmin) {
        return NextResponse.json({ error: 'Admin non trouvé' }, { status: 404 })
      }
      targetEmail = targetAdmin.email

      // Special check: modifying another admin's allowlist requires super_admin
      if (targetEmail !== callerEmail && callerRole !== 'super_admin') {
        return NextResponse.json(
          { error: 'Seul un super_admin peut modifier la whitelist IP d\'un autre administrateur' },
          { status: 403 }
        )
      }
    }

    // Upsert the admin record
    const existing = await db.platformAdmin.findUnique({ where: { email: targetEmail } })

    const ipsValue = allowedIps === null ? null : JSON.stringify(allowedIps)

    if (existing) {
      await db.platformAdmin.update({
        where: { email: targetEmail },
        data: { allowedIps: ipsValue },
      })
    } else {
      await db.platformAdmin.create({
        data: {
          email: targetEmail,
          allowedIps: ipsValue,
          createdBy: callerEmail,
        },
      })
    }

    return NextResponse.json({
      message: allowedIps === null
        ? 'IP whitelist supprimé — accès depuis toutes les IP'
        : `IP whitelist mis à jour (${(allowedIps as string[]).length} IP(s))`,
      allowedIps: allowedIps || null,
    })
  } catch (error) {
    logger.error('Error updating IP whitelist:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}, 'security:write');
