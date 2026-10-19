/**
 * Service email transactionnel — NightCRM
 *
 * Fournisseurs supportés (par ordre de priorité) :
 *   1. RESEND_API_KEY  → Resend (recommandé, production)
 *   2. SMTP_*          → nodemailer (fallback self-hosted)
 *   3. Aucun           → log console (mode développement uniquement)
 *
 * Architecture:
 *   - Async dynamic import() pour Resend (Turbopack-safe)
 *   - SMTP transport avec pool + reconnexion auto
 *   - Templates centralisés dans email-templates.ts
 *   - Toutes les fonctions sont enveloppées dans try/catch :
 *     une erreur d'envoi ne doit **jamais** planter l'application.
 *   - Audit logging sur chaque envoi réussi/échoué
 */

import { logAction } from './audit';
import {
  renderTemplate,
  type EmailTemplateName,
  type RenderedEmail,
} from './email-templates';
import { getResendApiKey } from './email-config';
import { env } from '@/lib/env-validator';
import { logger } from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>; // custom headers (Message-ID, References, etc.)
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
}

export interface EmailProviderStatus {
  provider: 'resend' | 'smtp' | 'console';
  configured: boolean;
  fromAddress: string;
  details?: {
    apiKeySet?: boolean;
    domain?: string;
  };
}

export interface EmailConfigValidation {
  isValid: boolean;
  provider: 'resend' | 'smtp' | 'console';
  warnings: string[];
  errors: string[];
}

// ─── Branded HTML Wrapper ────────────────────────────────────────────────────

export function buildHtmlEmail(bodyHtml: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  ${preheader ? `<div style="display:none;font-size:1px;color:#0a0e27;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
  <style>
    body { margin: 0; padding: 0; background-color: #0a0e27; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 560px; margin: 0 auto; padding: 32px 16px; }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px 12px 0 0; padding: 28px 32px; text-align: center; border-bottom: 2px solid #3b82f6; }
    .logo { font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; }
    .logo span { color: #3b82f6; }
    .body { background-color: #111827; padding: 32px; }
    .body-content { color: #e2e8f0; font-size: 15px; line-height: 1.7; }
    .body-content h2 { color: #ffffff; font-size: 18px; margin-top: 0; margin-bottom: 16px; }
    .body-content p { margin: 0 0 16px 0; }
    .body-content ul, .body-content ol { margin: 0 0 16px 0; padding-left: 24px; }
    .body-content li { margin-bottom: 8px; }
    .btn { display: inline-block; background-color: #3b82f6; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .btn:hover { background-color: #2563eb; }
    .btn-secondary { background-color: #1e293b; border: 1px solid #334155; }
    .btn-secondary:hover { background-color: #334155; }
    .badge { display: inline-block; background-color: #3b82f620; color: #3b82f6; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .divider { border: none; border-top: 1px solid #1e293b; margin: 20px 0; }
    .footer { background-color: #0f172a; border-radius: 0 0 12px 12px; padding: 20px 32px; text-align: center; }
    .footer p { color: #64748b; font-size: 12px; margin: 0; }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Night<span>CRM</span></div>
    </div>
    <div class="body">
      <div class="body-content">
        ${bodyHtml}
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} NightCRM — Gérez vos relations avec élégance.</p>
      <p style="margin-top: 6px;">
        <a href="https://nightcrm.app">nightcrm.app</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Singleton Resend client (async, Turbopack-safe) ──────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _resendClient: any = null;
let _resendInitPromise: Promise<void> | null = null;

async function initResendClient(): Promise<void> {
  if (_resendClient) return;
  if (_resendInitPromise) return _resendInitPromise;

  // Read API key from DB (SystemConfig) first, fall back to env var
  const apiKey = await getResendApiKey();
  if (!apiKey) return;

  // Re-check after async — another call may have already started initialization
  if (_resendClient) return;
  if (_resendInitPromise) return _resendInitPromise;

  _resendInitPromise = (async () => {
    try {
      const resend = await import('resend');
      _resendClient = new (resend as any).Resend(apiKey);
    } catch (err) {
      logger.error('[EMAIL] Failed to initialize Resend client:', err);
      _resendInitPromise = null;
    }
  })();

  return _resendInitPromise;
}

async function getResendClient() {
  await initResendClient();
  return _resendClient;
}

// ─── Singleton SMTP transport (pooled connections) ──────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _smtpTransport: any = null;

function getSmtpTransport() {
  if (_smtpTransport) return _smtpTransport;
  if (!env.SMTP_HOST || !env.SMTP_PORT) return null;

  try {
    // Dynamic import to defer loading until needed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require('nodemailer');
    _smtpTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      secure: Number(env.SMTP_PORT) === 465,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: {
        user: env.SMTP_USER || '',
        pass: env.SMTP_PASS || '',
      },
    });

    _smtpTransport.verify().catch((err: Error) => {
      logger.error('[EMAIL/SMTP] Connection verification failed:', err.message);
    });

    return _smtpTransport;
  } catch (err) {
    logger.error('[EMAIL/SMTP] Failed to initialize nodemailer:', err);
    return null;
  }
}

// ─── Provider detection ─────────────────────────────────────────────────────

type Provider = 'resend' | 'smtp' | 'console';

/**
 * Async provider detection — reads RESEND_API_KEY from DB (SystemConfig)
 * first, falling back to the env var. Use this in send paths where the
 * DB-configured key should take precedence.
 */
async function detectProviderAsync(): Promise<Provider> {
  const apiKey = await getResendApiKey();
  if (apiKey) return 'resend';
  if (env.SMTP_HOST && env.SMTP_PORT) return 'smtp';
  return 'console';
}

export async function getEmailProviderStatus(): Promise<EmailProviderStatus> {
  const provider = await detectProviderAsync();
  const fromAddress = env.EMAIL_FROM || 'NightCRM <noreply@nightcrm.app>';

  if (provider === 'resend') {
    const apiKey = await getResendApiKey();
    const fromMatch = fromAddress.match(/@([\w.-]+)/);
    return {
      provider: 'resend',
      configured: true,
      fromAddress,
      details: {
        apiKeySet: !!(apiKey && apiKey.length > 0),
        domain: fromMatch ? fromMatch[1] : undefined,
      },
    };
  }

  if (provider === 'smtp') {
    return {
      provider: 'smtp',
      configured: true,
      fromAddress,
      details: {
        domain: env.SMTP_HOST,
      },
    };
  }

  return {
    provider: 'console',
    configured: false,
    fromAddress,
  };
}

// ─── Email Configuration Validation ────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_FROM_REGEX = /^(?:([^<]+)\s*<)?([^\s@]+@[^\s@]+\.[^\s@]{2,})>?$/;

/**
 * Validate EMAIL_FROM format.
 * Accepts: "email@domain.com" or "Name <email@domain.com>"
 */
function validateEmailFrom(emailFrom: string | undefined): { valid: boolean; error?: string } {
  if (!emailFrom) {
    // Using default is acceptable
    return { valid: true };
  }

  const match = emailFrom.match(EMAIL_FROM_REGEX);
  if (!match) {
    return {
      valid: false,
      error: `EMAIL_FROM format invalid: "${emailFrom}". Expected "email@domain.com" or "Name <email@domain.com>"`,
    };
  }

  const emailPart = match[2];
  if (!emailPart || !EMAIL_REGEX.test(emailPart)) {
    return {
      valid: false,
      error: `EMAIL_FROM contains invalid email address: "${emailPart || 'undefined'}"`,
    };
  }

  return { valid: true };
}

/**
 * Validate email configuration at startup.
 * Checks that appropriate email provider is configured, especially in production.
 * Validates EMAIL_FROM format if set.
 *
 * VAL-INV-015: Branded invitation email is sent by Application
 * VAL-INV-044: Email sender address is recognized and trusted
 */
export async function validateEmailConfig(): Promise<EmailConfigValidation> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let isValid = true;

  // Detect provider
  const provider = await detectProviderAsync();
  const isProduction = env.NODE_ENV === 'production';

  // Validate EMAIL_FROM format
  const emailFromValidation = validateEmailFrom(env.EMAIL_FROM);
  if (!emailFromValidation.valid && emailFromValidation.error) {
    errors.push(emailFromValidation.error);
    isValid = false;
  }

  // Check provider configuration
  if (provider === 'resend') {
    const apiKey = await getResendApiKey();
    if (!apiKey || apiKey.length === 0) {
      errors.push('RESEND_API_KEY is empty or invalid');
      isValid = false;
    }
  } else if (provider === 'smtp') {
    // Validate SMTP configuration
    if (env.SMTP_HOST && !env.SMTP_PORT) {
      warnings.push('SMTP_HOST is set but SMTP_PORT is missing. Email sending may fail.');
    }
    if (env.SMTP_PORT && !env.SMTP_HOST) {
      warnings.push('SMTP_PORT is set but SMTP_HOST is missing. Email sending will not work.');
      isValid = false;
    }
  } else if (provider === 'console') {
    // Console mode in production is a problem
    if (isProduction) {
      warnings.push(
        'No email provider configured in production environment. ' +
        'Set RESEND_API_KEY or SMTP_HOST/SMTP_PORT to enable email delivery. ' +
        'Emails will only be logged to console (not sent).'
      );
      isValid = false;
    }
  }

  // Log results
  if (errors.length > 0) {
    logger.error('[EMAIL/CONFIG] Configuration errors detected:');
    errors.forEach(err => logger.error(`  - ${err}`));
  }

  if (warnings.length > 0 && isProduction) {
    logger.warn('[EMAIL/CONFIG] Configuration warnings:');
    warnings.forEach(warn => logger.warn(`  - ${warn}`));
  }

  if (isValid && provider !== 'console') {
    logger.info(`[EMAIL/CONFIG] Email provider configured: ${provider}`);
  }

  return {
    isValid,
    provider,
    warnings,
    errors,
  };
}

// ─── Input validation ───────────────────────────────────────────────────────

function validateRecipients(to: string | string[]): { valid: string[]; invalid: string[] } {
  const list = Array.isArray(to) ? to : [to];
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const addr of list) {
    if (typeof addr === 'string' && EMAIL_REGEX.test(addr)) {
      valid.push(addr);
    } else {
      invalid.push(String(addr));
    }
  }
  return { valid, invalid };
}

// ─── sendEmail (core — raw HTML) ───────────────────────────────────────────

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, html, text, from, replyTo, headers } = params;

  const { valid: recipients, invalid } = validateRecipients(to);
  if (invalid.length > 0) {
    return { success: false, error: `Destinataire(s) invalide(s) : ${invalid.join(', ')}` };
  }
  if (recipients.length === 0) {
    return { success: false, error: 'Aucun destinataire valide' };
  }
  if (recipients.length > 50) {
    return { success: false, error: `Trop de destinataires (${recipients.length}, max 50)` };
  }

  const defaultFrom = env.EMAIL_FROM || 'NightCRM <noreply@nightcrm.app>';
  const plainText = text || '';

  try {
    const provider = await detectProviderAsync();

    switch (provider) {
      case 'resend': {
        const client = await getResendClient();
        if (!client) {
          logger.error('[EMAIL] Resend client initialization failed');
          return { success: false, provider: 'resend', error: 'Client Resend non initialisé' };
        }

        const sendParams: Record<string, unknown> = {
          from: from || defaultFrom,
          to: recipients,
          subject,
          html,
        };
        if (plainText) sendParams.text = plainText;
        if (replyTo) sendParams.reply_to = replyTo;
        if (headers && Object.keys(headers).length > 0) sendParams.headers = headers;

        const { data, error } = await client.emails.send(sendParams);

        if (error) {
          logger.error('[EMAIL] Resend error:', error);
          return { success: false, provider: 'resend', error: error.message };
        }
        return { success: true, messageId: data?.id, provider: 'resend' };
      }

      case 'smtp': {
        const transport = getSmtpTransport();
        if (!transport) {
          logger.error('[EMAIL/SMTP] Transport initialization failed');
          return { success: false, provider: 'smtp', error: 'Transport SMTP non initialisé' };
        }

        const smtpParams: Record<string, unknown> = {
          from: from || defaultFrom,
          to: recipients.join(', '),
          subject,
          html,
          text: plainText || undefined,
          replyTo: replyTo || undefined,
        };
        if (headers && Object.keys(headers).length > 0) smtpParams.headers = headers;

        const info = await transport.sendMail(smtpParams);
        return { success: true, messageId: info.messageId, provider: 'smtp' };
      }

      case 'console':
      default: {
        if (env.NODE_ENV === 'development') {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('[EMAIL] Mode développement — SIMULATION (aucun envoi réel)');
          console.log(`[EMAIL] De : ${from || defaultFrom}`);
          console.log(`[EMAIL] À   : ${recipients.join(', ')}`);
          console.log(`[EMAIL] Sujet : ${subject}`);
          console.log('[EMAIL] HTML :');
          console.log(html);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
        return { success: false, provider: 'console', error: 'Aucun fournisseur configuré (mode simulation)' };
      }
    }
  } catch (err) {
    logger.error('[EMAIL] Erreur lors de l\'envoi :', err);
    return { success: false, error: err instanceof Error ? err.message : 'Erreur inconnue' };
  }
}

// ─── sendTemplatedEmail (core — template-based) ────────────────────────────

/**
 * Render a named template and send it.
 * This is the preferred way to send transactional emails.
 */
export async function sendTemplatedEmail(
  templateName: EmailTemplateName,
  to: string | string[],
  vars: Record<string, unknown>,
  options?: { from?: string; replyTo?: string },
): Promise<SendEmailResult> {
  let rendered: RenderedEmail;
  try {
    rendered = renderTemplate(templateName, vars, buildHtmlEmail);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur de rendu du template';
    logger.error(`[EMAIL/TEMPLATE] ${msg}`);
    return { success: false, error: msg };
  }

  return sendEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    from: options?.from,
    replyTo: options?.replyTo,
  });
}

// ─── Convenience wrappers (backward-compatible public API) ──────────────────
// Each delegates to sendTemplatedEmail with the right template + vars.

export async function sendWelcomeEmail(to: string, displayName: string): Promise<SendEmailResult> {
  const result = await sendTemplatedEmail('welcome', to, { displayName });
  logEmailResult('welcome', to, result);
  return result;
}

export async function sendTeamInvitationEmail(
  to: string,
  invitedBy: string,
  workspaceName: string,
  acceptLink: string,
): Promise<SendEmailResult> {
  const result = await sendTemplatedEmail('team_invitation', to, { invitedBy, workspaceName, acceptLink });
  logEmailResult('team_invitation', to, result);
  return result;
}

export async function sendTestEmail(to: string): Promise<SendEmailResult> {
  const result = await sendTemplatedEmail('test', to, {});
  logEmailResult('test', to, result);
  return result;
}

// ─── Audit logging ───────────────────────────────────────────────────────────

function logEmailResult(emailType: string, recipient: string, result: SendEmailResult): void {
  try {
    logAction({
      action: result.success ? 'email_sent' : 'email_failed',
      entityType: 'email',
      entityId: result.messageId || undefined,
      entityTitle: `${emailType} → ${recipient}`,
      details: {
        summary: `Email ${emailType} ${result.success ? 'envoyé' : 'échoué'} à ${recipient} (provider: ${result.provider || 'unknown'})`,
        emailType,
        recipient,
        provider: result.provider,
        messageId: result.messageId,
        error: result.error,
      },
    });
  } catch {
    // Non-blocking
  }
}
