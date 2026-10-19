/**
 * csrf.ts — Protection CSRF via le pattern double-submit cookie
 *
 * Le cookie __Host-csrf-token est fixe par le serveur (HttpOnly, SameSite=Strict, Secure).
 * Le client doit renvoyer la meme valeur dans le header `x-csrf-token`.
 * Si les deux correspondent = la requete provient du meme origine.
 */

import { NextResponse, type NextRequest } from 'next/server'

export const CSRF_COOKIE_NAME = '__Host-csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'

export function generateCsrfToken(): string {
  return crypto.randomUUID()
}

export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  })
}

export function getCsrfTokenFromCookie(request: NextRequest): string | null {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value ?? null
}

export function validateCsrf(request: NextRequest): { valid: boolean; error?: string } {
  const cookieToken = getCsrfTokenFromCookie(request)
  const headerToken = request.headers.get(CSRF_HEADER_NAME)

  if (!cookieToken) {
    return { valid: false, error: 'Token CSRF manquant dans le cookie' }
  }

  if (!headerToken) {
    return { valid: false, error: 'Header x-csrf-token manquant' }
  }

  if (!timingSafeEqual(cookieToken, headerToken)) {
    return { valid: false, error: 'Token CSRF invalide' }
  }

  return { valid: true }
}

export function getCsrfProtectionHeaders(token: string): Record<string, string> {
  return {
    [CSRF_HEADER_NAME]: token,
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const encoder = new TextEncoder()
  const aBuf = encoder.encode(a)
  const bBuf = encoder.encode(b)
  let result = 0
  for (let i = 0; i < aBuf.length; i++) {
    result |= aBuf[i]! ^ bBuf[i]!
  }
  return result === 0
}
