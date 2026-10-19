import { type NextRequest, NextResponse } from 'next/server';

/**
 * Minimal middleware for control app.
 * Supabase session management will be added once edge runtime compatibility is resolved.
 */
export async function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
