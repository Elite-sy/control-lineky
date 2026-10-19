/**
 * GET /api/admin/csrf-token
 *
 * Returns a CSRF token for the admin console.
 * The token is set as a __Host-csrf-token cookie and also returned in the response body.
 * Client must include this token in the x-csrf-token header for all mutating requests.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAdminAuth } from '@lineky/platform-auth/admin-guard';
import { generateCsrfToken, setCsrfCookie } from '@lineky/platform-auth/csrf';

export const dynamic = 'force-dynamic';

export const GET = withAdminAuth(async (_req: NextRequest) => {
  const token = generateCsrfToken();
  const response = NextResponse.json({ 
    token,
    message: 'CSRF token generated successfully'
  });
  
  setCsrfCookie(response, token);
  
  return response;
}, 'system-config:read');
