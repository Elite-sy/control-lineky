/**
 * POST /api/admin/system-config/test-email
 *
 * Sends a test email using the configured email provider.
 * Uses the core sendTestEmail() from the email service.
 * Reserved for platform administrators.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAdminAuth } from '@lineky/platform-auth/admin-guard';
import { sendTestEmail } from '@/services/email';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { to } = body;

    if (!to || typeof to !== 'string') {
      return NextResponse.json(
        { error: 'Adresse email requise' },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json(
        { error: 'Adresse email invalide' },
        { status: 400 },
      );
    }

    const result = await sendTestEmail(to);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Email de test envoyé à ${to}`,
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Erreur lors de l\'envoi' },
        { status: 500 },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[Admin SystemConfig] Test email error:', message);
    return NextResponse.json({ error: 'Erreur lors de l\'envoi du test' }, { status: 500 });
  }
}, 'system-config:write');
