/**
 * GET /api/admin/csrf-token
 *
 * Returns a CSRF token for the admin console.
 * The token is set as a __Host-csrf-token cookie and also returned in the response body.
 * Client must include this token in the x-csrf-token header for all mutating requests.
 * 
 * Note: This endpoint does not require authentication. The CSRF token itself provides
 * protection against cross-site request forgery. Authentication is enforced on the
 * endpoints that accept the CSRF token.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateCsrfToken, setCsrfCookie } from '@lineky/platform-auth/csrf';

// Cache invalidation
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const token = generateCsrfToken();
  const response = NextResponse.json({ 
    token,
    message: 'CSRF token generated successfully'
  });
  
  setCsrfCookie(response, token);
  
  return response;
}
