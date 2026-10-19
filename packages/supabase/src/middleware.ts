import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Fail-closed: if Supabase is not configured, block all CRM API routes
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (request.nextUrl.pathname.startsWith('/api/crm/')) {
      return NextResponse.json(
        { error: 'Service non configuré' },
        { status: 503 },
      )
    }
    return NextResponse.next({ request })
  }

  try {
    let supabaseResponse = NextResponse.next({
      request,
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            )
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, {
                ...options,
                domain: '.lineky.com',
              }),
            )
          },
        },
      },
    )

    const pathname = request.nextUrl.pathname

    // ─── Portal subdomain detection ───────────────────────────────────
    // portal.lineky.com → treat page paths as /portal/* for auth checks.
    // API routes are NOT rewritten (portal API routes stay at /api/portal/*).
    const host = request.headers.get('host') || ''
    const isPortalHost = host.startsWith('portal.')
    const effectivePath =
      isPortalHost && !pathname.startsWith('/portal') && !pathname.startsWith('/api/')
        ? `/portal${pathname}`
        : pathname

    // Routes publiques (pas de protection)
    const isPublicRoute =
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/api/auth/')

    // Route interne d'import self-chaining — protégée par HMAC, pas par session
    const isInternalImportRoute = pathname === '/api/crm/import/process'

    // Routes API CRM — vérifier l'authentification
    if (pathname.startsWith('/api/crm/') && !isInternalImportRoute) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json(
          { error: 'Non autorisé — connexion requise' },
          { status: 401 },
        )
      }
      // Ajouter l'email utilisateur dans les headers de requête pour les routes API
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-email', user.email ?? '');
      // P0 Étape 2: passer aussi l'authUserId pour la résolution workspace
      requestHeaders.set('x-user-id', user.id);

      return NextResponse.next({
        request: { headers: requestHeaders },
      })
    }

    // ─── Portail Client : protéger les pages /portal/* ───────────────
    // Les pages /portal/login et /portal/auth/callback sont publiques.
    // Toutes les autres pages /portal/* requièrent une session.
    // effectivePath tient compte du sous-domaine portal (portal.lineky.com).
    const isPortalPublicRoute =
      effectivePath.startsWith('/portal/login') ||
      effectivePath.startsWith('/portal/auth/callback')

    if (effectivePath.startsWith('/portal/') && !isPortalPublicRoute) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        // Rediriger vers login avec le paramètre redirect-back
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/portal/login'
        redirectUrl.search = ''
        redirectUrl.searchParams.set('redirect', effectivePath)
        return NextResponse.redirect(redirectUrl)
      }
    }

    // Routes pages — rafraîchir la session (le client gère l'affichage login/CRM)
    if (!isPublicRoute) {
      await supabase.auth.getUser()
    }

    return supabaseResponse
  } catch (error) {
    console.error('[middleware] Error:', error)
    // Sécurité : les routes API CRM doivent ALWAYS être protégées
    // (sauf /api/crm/import/process qui a sa propre auth HMAC)
    const pathname = request.nextUrl.pathname
    if (pathname.startsWith('/api/crm/') && pathname !== '/api/crm/import/process') {
      return NextResponse.json(
        { error: 'Non autorisé — erreur interne' },
        { status: 503 },
      )
    }
    // Pour les routes pages, laisser passer (le client gère l'affichage login)
    return NextResponse.next({ request })
  }
}
