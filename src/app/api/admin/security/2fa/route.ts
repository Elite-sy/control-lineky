/**
 * POST /api/admin/security/2fa/setup
 *   Generate TOTP secret and QR code data URL
 *   Returns: { secret, qrCodeDataUrl, otpAuthUrl }
 *
 * POST /api/admin/security/2fa/verify
 *   Verify a TOTP code to enable 2FA
 *   Body: { secret, code }
 *   Returns: { enabled: true }
 *
 * POST /api/admin/security/2fa/disable
 *   Disable 2FA (requires current TOTP code for security)
 *   Body: { code }
 *   Returns: { enabled: false }
 * 
 * Self-service route: admins manage their own 2FA configuration.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { db } from '@lineky/database'
import { TOTP, generateSecret, generateURI } from 'otplib'

const totp = new TOTP()
import QRCode from 'qrcode'
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic'

const APP_NAME = 'NightCRM Admin'

export const POST = withAdminAuth(async (req: NextRequest) => {
  // Get caller's email
  const supabase = await (await import('@lineky/supabase/server')).createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const email = user.email

  try {
    const body = await req.json()
    const { action } = body

    if (action === 'setup') {
      return handleSetup(email)
    } else if (action === 'verify') {
      return handleVerify(email, body.secret, body.code)
    } else if (action === 'disable') {
      return handleDisable(email, body.code)
    }

    return NextResponse.json({ error: 'Action non reconnue. Utilisez setup, verify, ou disable.' }, { status: 400 })
  } catch (error) {
    logger.error('2FA error:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'opération 2FA' }, { status: 500 })
  }
}, 'security:read');

async function handleSetup(email: string) {
  // Check if already has 2FA
  try {
    const admin = await db.platformAdmin.findUnique({ where: { email: email.toLowerCase() } })
    if (admin?.twoFactorEnabled) {
      return NextResponse.json({ error: '2FA déjà activé. Désactivez-le d\'abord.' }, { status: 400 })
    }
  } catch {
    // Table doesn't exist yet — allow setup (will create on verify)
  }

  // Generate secret
  const secret = generateSecret()
  const otpAuthUrl = generateURI({ issuer: APP_NAME, label: email, secret })

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, {
    width: 200,
    margin: 2,
    color: { dark: '#3b82f6', light: '#0f172a' },
  })

  return NextResponse.json({
    secret,
    otpAuthUrl,
    qrCodeDataUrl,
    message: 'Scannez le QR code avec votre app d\'authentification',
  })
}

async function handleVerify(email: string, secret: string | undefined, code: string | undefined) {
  if (!secret || !code) {
    return NextResponse.json({ error: 'secret et code sont requis' }, { status: 400 })
  }

  // Verify TOTP code
  const result = await totp.verify(code, { secret })
  if (!result.valid) {
    return NextResponse.json({ error: 'Code invalide. Réessayez.' }, { status: 401 })
  }

  // Upsert admin record with 2FA enabled
  const normalized = email.toLowerCase()
  const existing = await db.platformAdmin.findUnique({ where: { email: normalized } })

  if (existing) {
    await db.platformAdmin.update({
      where: { email: normalized },
      data: { twoFactorEnabled: true, twoFactorSecret: secret },
    })
  } else {
    // Create admin record (first time DB entry)
    await db.platformAdmin.create({
      data: {
        email: normalized,
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        createdBy: 'self-setup-2fa',
      },
    })
  }

  return NextResponse.json({ enabled: true, message: '2FA activé avec succès' })
}

async function handleDisable(email: string, code: string | undefined) {
  if (!code) {
    return NextResponse.json({ error: 'Code TOTP requis pour désactiver' }, { status: 400 })
  }

  const normalized = email.toLowerCase()
  const admin = await db.platformAdmin.findUnique({ where: { email: normalized } })

  if (!admin || !admin.twoFactorSecret) {
    return NextResponse.json({ error: '2FA non configuré' }, { status: 404 })
  }

  // Verify code before disabling
  const result2 = await totp.verify(code, { secret: admin.twoFactorSecret })
  if (!result2.valid) {
    return NextResponse.json({ error: 'Code invalide' }, { status: 401 })
  }

  await db.platformAdmin.update({
    where: { email: normalized },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  })

  return NextResponse.json({ enabled: false, message: '2FA désactivé' })
}
