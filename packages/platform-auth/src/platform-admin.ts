/**
 * platform-admin.ts — Détection des administrateurs plateforme
 *
 * Deux sources de vérité :
 *   1. Variable d'environnement PLATFORM_ADMIN_EMAILS (bootstrap, fallback)
 *   2. Table PlatformAdmin en base de données (multi-admin dynamique)
 *
 * Sécurité :
 *   - Vérification 2FA TOTP pour les admins qui l'ont activée
 *   - Vérification IP whitelist pour les admins qui ont configuré des IPs
 */

import { db } from '@lineky/database'

/** Récupère la liste des emails admin plateforme depuis les env vars */
export function getPlatformAdminEmails(): string[] {
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/** Vérification synchrone via env var uniquement (fallback rapide) */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return getPlatformAdminEmails().includes(email.toLowerCase())
}

export interface AdminCheckResult {
  isAdmin: boolean
  admin?: {
    id: string
    email: string
    role: string
    isActive: boolean
    twoFactorEnabled: boolean
    allowedIps: string | null
  }
  source: 'env' | 'database' | 'env+db' | 'none'
}

/**
 * Vérification complète : env var + DB
 * Retourne les infos admin pour les vérifications 2FA/IP
 */
export async function checkPlatformAdmin(
  email: string | null | undefined,
): Promise<AdminCheckResult> {
  if (!email) return { isAdmin: false, source: 'none' }

  const normalized = email.toLowerCase()

  // Fast path: env var check
  if (getPlatformAdminEmails().includes(normalized)) {
    // Check DB for additional security info (2FA, IP whitelist)
    try {
      const dbAdmin = await db.platformAdmin.findUnique({ where: { email: normalized } })
      if (dbAdmin && dbAdmin.isActive) {
        return {
          isAdmin: true,
          admin: {
            id: dbAdmin.id,
            email: dbAdmin.email,
            role: dbAdmin.role,
            isActive: dbAdmin.isActive,
            twoFactorEnabled: dbAdmin.twoFactorEnabled,
            allowedIps: dbAdmin.allowedIps,
          },
          source: 'env+db',
        }
      }
    } catch {
      // DB unavailable, env var is enough
    }
    return { isAdmin: true, source: 'env' }
  }

  // DB check
  try {
    const dbAdmin = await db.platformAdmin.findUnique({ where: { email: normalized } })
    if (dbAdmin && dbAdmin.isActive) {
      return {
        isAdmin: true,
        admin: {
          id: dbAdmin.id,
          email: dbAdmin.email,
          role: dbAdmin.role,
          isActive: dbAdmin.isActive,
          twoFactorEnabled: dbAdmin.twoFactorEnabled,
          allowedIps: dbAdmin.allowedIps,
        },
        source: 'database',
      }
    }
  } catch {
    // DB unavailable
  }

  return { isAdmin: false, source: 'none' }
}

/**
 * Vérifie si une adresse IP est autorisée.
 * - Si allowedIps est null ou vide → autorise toutes les IPs
 * - Sinon vérifie que l'IP est dans la liste (support CIDR notation basique)
 */
export function isIpAllowed(clientIp: string | null, allowedIps: string | null): boolean {
  if (!allowedIps) return true // No restriction
  if (!clientIp) return false // No client IP but restriction active → deny

  try {
    const ips: string[] = JSON.parse(allowedIps)
    if (ips.length === 0) return true

    const cleanIp = clientIp.replace(/^::ffff:/, '') // Remove IPv6 prefix if present

    return ips.some(allowed => {
      if (allowed.includes('/')) {
        // CIDR notation — simple prefix match for /24 and /32
        const [network, bits] = allowed.split('/')
        const maskBits = parseInt(bits!, 10)
        if (maskBits === 32) return network === cleanIp
        if (maskBits === 0) return true
        // Simple /8, /16, /24 check
        const networkParts = network!.split('.').map(Number)
        const ipParts = cleanIp.split('.').map(Number)
        const fullOctets = Math.floor(maskBits / 8)
        for (let i = 0; i < fullOctets; i++) {
          if (networkParts[i] !== ipParts[i]) return false
        }
        return true
      }
      // Exact match
      return allowed === cleanIp
    })
  } catch {
    return true // Invalid JSON → allow by default
  }
}
