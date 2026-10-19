/**
 * Email Template System — NightCRM
 *
 * Architecture:
 *   - Chaque template est un objet typé dans le registre EMAIL_TEMPLATES
 *   - Chaque template définit : nom, sujet, preheader, variables requises, rendu HTML/text
 *   - renderTemplate(name, data) → { subject, html, text, preheader }
 *   - Toutes les variables sont échappées (XSS-safe)
 *   - Séparé de email.ts (logique d'envoi) vs email-templates.ts (logique de rendu)
 *
 * Pour ajouter un nouveau template :
 *   1. Ajouter une clé dans EmailTemplateName
 *   2. Créer l'entrée dans EMAIL_TEMPLATES avec render() typé
 */

// ─── Template Registry Types ─────────────────────────────────────────────────

export type EmailTemplateName =
  | 'welcome'
  | 'password_reset'
  | 'team_invitation'
  | 'billing_receipt'
  | 'contact_followup'
  | 'deal_update'
  | 'task_reminder'
  | 'document_shared'
  | 'email_verification'
  | 'account_deletion'
  | 'test';

/** Metadata visible via API (no implementation details exposed) */
export interface EmailTemplateMeta {
  name: EmailTemplateName;
  label: string;
  description: string;
  category: 'auth' | 'team' | 'billing' | 'crm' | 'system';
  requiredVars: string[];
}

/** Full template definition (internal only, never exposed via API) */
interface EmailTemplateDefinition<TVars extends Record<string, unknown>> {
  label: string;
  description: string;
  category: 'auth' | 'team' | 'billing' | 'crm' | 'system';
  requiredVars: (keyof TVars)[];
  /** Dynamic subject line — may reference template vars */
  subject: (vars: TVars) => string;
  /** Preheader text (preview in email clients) */
  preheader: (vars: TVars) => string;
  /** Renders HTML body (inside the branded wrapper) */
  html: (vars: TVars) => string;
}

// ─── Shared HTML Components (reusable blocks) ────────────────────────────────

function h2(text: string): string {
  return `<h2>${text}</h2>`;
}

function p(text: string, attrs = ''): string {
  return `<p${attrs ? ` ${attrs}` : ''}>${text}</p>`;
}

function button(label: string, url: string, style = 'btn'): string {
  return `<p style="text-align: center; margin: 28px 0;">
    <a href="${esc(url)}" class="${style}">${esc(label)}</a>
  </p>`;
}

function badge(text: string): string {
  return `<span class="badge">${esc(text)}</span>`;
}

function divider(): string {
  return '<hr class="divider" />';
}

function bulletList(items: string[]): string {
  return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

function dataRow(label: string, value: string, color = '#ffffff', borderBottom = true): string {
  return `<tr>
    <td style="padding: 12px 16px; color: #94a3b8; font-size: 13px;${borderBottom ? ' border-bottom: 1px solid #334155;' : ''}">${esc(label)}</td>
    <td style="padding: 12px 16px; color: ${color}; font-size: 13px; text-align: right;${borderBottom ? ' border-bottom: 1px solid #334155;' : ''}${color === '#22c55e' ? ' font-weight: 600;' : ''}">${esc(value)}</td>
  </tr>`;
}

// ─── XSS Escaping ───────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Template Definitions ───────────────────────────────────────────────────

const EMAIL_TEMPLATES: {
  [K in EmailTemplateName]: EmailTemplateDefinition<Record<string, unknown>>;
} = {
  // ── Auth Templates ──

  welcome: {
    label: 'Bienvenue',
    description: 'Envoyé après la première inscription d\'un utilisateur',
    category: 'auth',
    requiredVars: ['displayName'],
    subject: () => 'Bienvenue sur NightCRM',
    preheader: (v) => `Bienvenue sur NightCRM, ${v.displayName} — votre CRM est prêt`,
    html: (v) => `
      ${h2(`Bienvenue sur NightCRM, ${esc(v.displayName as string)} !`)}
      ${p('Votre compte a été créé avec succès. Vous pouvez maintenant accéder à votre espace de travail et commencer à gérer vos relations clients.')}
      ${p('NightCRM vous offre :')}
      ${bulletList([
        'Un tableau de bord intuitif pour piloter votre activité',
        'Une gestion complète des contacts et entreprises',
        'Un suivi des deals et factures',
        'Des tâches et tickets pour organiser votre équipe',
      ])}
      ${p('Si vous avez des questions, n\'hésitez pas à nous contacter.')}
      ${p('À très vite !<br />L\'équipe NightCRM')}
    `,
  },

  password_reset: {
    label: 'Réinitialisation de mot de passe',
    description: 'Lien de réinitialisation envoyé à la demande de l\'utilisateur',
    category: 'auth',
    requiredVars: ['resetLink'],
    subject: () => 'Réinitialisation de votre mot de passe — NightCRM',
    preheader: () => 'Lien de réinitialisation de mot de passe',
    html: (v) => `
      ${h2('Réinitialisation de votre mot de passe')}
      ${p('Vous avez demandé la réinitialisation du mot de passe associé à cette adresse.')}
      ${p('Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe. Ce lien est valable 1 heure.')}
      ${button('Réinitialiser mon mot de passe', v.resetLink as string)}
      ${p('Si vous n\'êtes pas à l\'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.')}
    `,
  },

  email_verification: {
    label: 'Vérification d\'email',
    description: 'Confirmation d\'adresse email lors de l\'inscription',
    category: 'auth',
    requiredVars: ['verifyLink'],
    subject: () => 'Vérifiez votre adresse email — NightCRM',
    preheader: () => 'Confirmez votre adresse email pour activer votre compte',
    html: (v) => `
      ${h2('Vérifiez votre adresse email')}
      ${p('Merci de vous être inscrit sur NightCRM. Pour activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.')}
      ${button('Vérifier mon email', v.verifyLink as string)}
      ${p('Ce lien expire dans 24 heures. Si vous n\'avez pas créé de compte, vous pouvez ignorer cet email.')}
    `,
  },

  account_deletion: {
    label: 'Suppression de compte',
    description: 'Confirmation de demande de suppression de compte',
    category: 'auth',
    requiredVars: ['confirmLink'],
    subject: () => 'Confirmation de suppression de compte — NightCRM',
    preheader: () => 'Votre demande de suppression de compte',
    html: (v) => `
      ${h2('Demande de suppression de compte')}
      ${p('Vous avez demandé la suppression de votre compte NightCRM. Cette action est irréversible et toutes vos données seront définitivement supprimées.')}
      ${p('Pour confirmer, cliquez sur le bouton ci-dessous.')}
      ${button('Confirmer la suppression', v.confirmLink as string, 'btn-secondary')}
      ${p('Si vous n\'êtes pas à l\'origine de cette demande, changez immédiatement votre mot de passe et contactez le support.')}
    `,
  },

  // ── Team Templates ──

  team_invitation: {
    label: 'Invitation équipe',
    description: 'Invitation à rejoindre un espace de travail',
    category: 'team',
    requiredVars: ['invitedBy', 'workspaceName', 'acceptLink'],
    subject: (v) => `Invitation à rejoindre « ${v.workspaceName} » — NightCRM`,
    preheader: (v) => `Invitation de ${v.invitedBy} à rejoindre ${v.workspaceName}`,
    html: (v) => `
      ${h2('Vous êtes invité à rejoindre un espace de travail')}
      ${p(`<strong>${esc(v.invitedBy as string)}</strong> vous invite à rejoindre l'espace de travail <strong>${esc(v.workspaceName as string)}</strong> sur NightCRM.`)}
      ${button('Accepter l\'invitation', v.acceptLink as string)}
      ${p('Si vous n\'êtes pas intéressé, vous pouvez simplement ignorer cet e-mail.')}
      ${p('À bientôt !<br />L\'équipe NightCRM')}
    `,
  },

  // ── Billing Templates ──

  billing_receipt: {
    label: 'Reçu de facturation',
    description: 'Reçu de paiement envoyé après un abonnement',
    category: 'billing',
    requiredVars: ['planName', 'amount', 'date'],
    subject: (v) => `Reçu de paiement — ${v.planName} — NightCRM`,
    preheader: (v) => `Reçu de paiement ${v.planName} — ${v.amount}`,
    html: (v) => `
      ${h2('Votre reçu de paiement')}
      ${p('Merci pour votre abonnement à NightCRM. Voici le récapitulatif de votre paiement :')}
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #1e293b; border-radius: 8px; overflow: hidden;">
        ${dataRow('Forfait', v.planName as string)}
        ${dataRow('Montant', v.amount as string, '#22c55e')}
        ${dataRow('Date', v.date as string, '#ffffff', false)}
      </table>
      ${p('Vous pouvez consulter vos factures à tout moment dans les paramètres de votre compte.')}
      ${p('Merci de faire confiance à NightCRM !<br />L\'équipe NightCRM')}
    `,
  },

  // ── CRM Templates ──

  contact_followup: {
    label: 'Suivi de contact',
    description: 'Relance automatisée ou manuelle vers un contact',
    category: 'crm',
    requiredVars: ['contactName', 'message', 'fromName'],
    subject: (v) => `Suivi — ${v.companyName || v.contactName}`,
    preheader: (v) => `Suivi de ${v.contactName}`,
    html: (v) => {
      const companyLine = v.companyName ? p(`Entreprise : ${badge(v.companyName as string)}`) : '';
      return `
        ${h2(`Bonjour ${esc(v.contactName as string)}`)}
        ${companyLine}
        ${divider()}
        ${p(esc(v.message as string).replace(/\n/g, '<br />'))}
        ${divider()}
        ${p(`Cordialement,<br /><strong>${esc(v.fromName as string)}</strong><br />NightCRM`)}
      `;
    },
  },

  deal_update: {
    label: 'Mise à jour de deal',
    description: 'Notification de changement de statut d\'un deal',
    category: 'crm',
    requiredVars: ['dealName', 'stage'],
    subject: (v) => `Deal mis à jour : ${v.dealName}`,
    preheader: (v) => `Deal ${v.dealName} → ${v.stage}`,
    html: (v) => {
      const amountLine = v.amount ? p(`Montant : <strong style="color: #22c55e;">${esc(v.amount as string)}</strong>`) : '';
      const companyLine = v.companyName ? p(`Entreprise : ${badge(v.companyName as string)}`) : '';
      return `
        ${h2('Deal mis à jour')}
        ${p(`<strong>${esc(v.dealName as string)}</strong> a été déplacé vers le statut :`)}
        <p style="text-align: center; margin: 20px 0;">
          ${badge(v.stage as string)}
        </p>
        ${companyLine}
        ${amountLine}
      `;
    },
  },

  task_reminder: {
    label: 'Rappel de tâche',
    description: 'Rappel envoyé avant l\'échéance d\'une tâche',
    category: 'crm',
    requiredVars: ['taskTitle', 'dueDate', 'assignedByName'],
    subject: (v) => `Rappel : ${v.taskTitle}`,
    preheader: (v) => `Tâche : ${v.taskTitle}`,
    html: (v) => `
      ${h2('Rappel de tâche')}
      ${p('Vous avez une tâche à compléter :')}
      <p style="text-align: center; margin: 20px 0;">
        <strong style="font-size: 16px; color: #ffffff;">${esc(v.taskTitle as string)}</strong>
      </p>
      ${p(`Échéance : <strong>${esc(v.dueDate as string)}</strong>`)}
      ${p(`Assignée par : ${esc(v.assignedByName as string)}`)}
    `,
  },

  document_shared: {
    label: 'Document partagé',
    description: 'Notification lorsqu\'un document est partagé avec un utilisateur',
    category: 'crm',
    requiredVars: ['documentName', 'sharedBy', 'accessUrl'],
    subject: (v) => `Document partagé : ${v.documentName}`,
    preheader: (v) => `Document partagé : ${v.documentName}`,
    html: (v) => `
      ${h2('Un document vous a été partagé')}
      ${p(`<strong>${esc(v.sharedBy as string)}</strong> a partagé le document suivant avec vous :`)}
      <p style="text-align: center; margin: 20px 0;">
        <strong style="font-size: 16px; color: #ffffff;">${esc(v.documentName as string)}</strong>
      </p>
      ${button('Ouvrir le document', v.accessUrl as string)}
      ${p('Ce lien expire dans 24 heures.')}
    `,
  },

  // ── System Templates ──

  test: {
    label: 'Email de test',
    description: 'Permet à un admin de vérifier la configuration email',
    category: 'system',
    requiredVars: [],
    subject: () => 'NightCRM — Test de configuration email',
    preheader: () => 'Test de configuration email — NightCRM',
    html: () => `
      ${h2('Email de test réussi !')}
      ${p('Cet email confirme que votre fournisseur d\'envoi est correctement configuré.')}
      ${p('Vous pouvez maintenant envoyer des emails transactionnels depuis NightCRM :')}
      ${bulletList([
        'Invitations d\'équipe',
        'Réinitialisation de mot de passe',
        'Suivi de contacts',
        'Notifications de deals',
        'Rappels de tâches',
        'Reçus de facturation',
      ])}
    `,
  },
};

// ─── Template Renderer ──────────────────────────────────────────────────────

export interface RenderedEmail {
  subject: string;
  html: string;
  preheader: string;
  /** Auto-generated plain text from HTML */
  text: string;
}

/**
 * Render a template by name with the given variables.
 * Validates required variables are present before rendering.
 *
 * @throws Error if template name is unknown or required vars are missing
 */
export function renderTemplate(
  name: EmailTemplateName,
  vars: Record<string, unknown>,
  wrapper: (bodyHtml: string, preheader?: string) => string,
): RenderedEmail {
  const tpl = EMAIL_TEMPLATES[name];
  if (!tpl) {
    throw new Error(`Template email inconnu : "${name}"`);
  }

  // Validate required vars
  const missing = tpl.requiredVars.filter((k) => vars[k] === undefined || vars[k] === null || vars[k] === '');
  if (missing.length > 0) {
    throw new Error(`Variables requises manquantes pour le template "${name}" : ${missing.join(', ')}`);
  }

  // Cast vars to satisfy TypeScript (validated above)
  const safeVars = vars as Record<string, unknown>;

  const subject = tpl.subject(safeVars);
  const preheader = tpl.preheader(safeVars);
  const bodyHtml = tpl.html(safeVars);
  const fullHtml = wrapper(bodyHtml, preheader);

  // Auto-generate plain text
  const text = htmlToPlainText(fullHtml);

  return { subject, html: fullHtml, preheader, text };
}

/**
 * List all available templates with metadata (for UI/API).
 */
export function listTemplates(): EmailTemplateMeta[] {
  return (Object.keys(EMAIL_TEMPLATES) as EmailTemplateName[]).map((name) => {
    const tpl = EMAIL_TEMPLATES[name];
    return {
      name,
      label: tpl.label,
      description: tpl.description,
      category: tpl.category,
      requiredVars: tpl.requiredVars as string[],
    };
  });
}

/**
 * Get metadata for a single template.
 */
export function getTemplateMeta(name: EmailTemplateName): EmailTemplateMeta | null {
  const tpl = EMAIL_TEMPLATES[name];
  if (!tpl) return null;
  return {
    name,
    label: tpl.label,
    description: tpl.description,
    category: tpl.category,
    requiredVars: tpl.requiredVars as string[],
  };
}

// ─── Text extraction (HTML → plain text) ────────────────────────────────────

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(div|p|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '  • ')
    .replace(/<\/t[dh][^>]*>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Re-export esc for email.ts to use
export { esc as escapeHtml };
