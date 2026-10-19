# BUGS_AND_FIXES.md

Liste exhaustive de tous les problèmes rencontrés et leurs solutions lors du développement du projet control-lineky.

---

## Bug #1 : Prisma client non généré sur Vercel

**Date** : 19 octobre 2026  
**Commit** : `929af51` - "fix: configure Prisma client generation for Vercel builds"

**Symptôme** :
```
Error: @prisma/client did not initialize yet. 
Please run "prisma generate" and try to import it again.
```

**Cause** :
Le client Prisma n'était pas généré automatiquement lors du build Vercel. Le package `@lineky/database` contenait le schéma Prisma mais le client n'était pas compilé.

**Solution** :
1. Ajout du script `postinstall` dans `package.json` :
   ```json
   "postinstall": "cd packages/database && npx prisma generate"
   ```
2. Configuration du client Prisma pour gérer `DATABASE_URL` manquante au build time
3. Génération automatique après chaque `pnpm install`

**Statut** : ✅ Résolu

---

## Bug #2 : Postinstall exécuté depuis le mauvais répertoire

**Date** : 19 octobre 2026  
**Commit** : `ce3ba7f` - "fix: update postinstall to run prisma generate from database package"

**Symptôme** :
```
Error: Could not find Prisma Schema at default location
```

**Cause** :
Le script `postinstall` essayait d'exécuter `prisma generate` depuis la racine du projet au lieu du package `database`.

**Solution** :
Mise à jour du script pour naviguer dans le bon répertoire :
```json
"postinstall": "cd packages/database && npx prisma generate"
```

**Statut** : ✅ Résolu

---

## Bug #3 : Versions Next.js incohérentes entre packages

**Date** : 19 octobre 2026  
**Commit** : `527980c` - "fix: align Next.js versions across all workspace packages"

**Symptôme** :
```
Error: Multiple versions of Next.js detected
Warning: Mismatched peer dependencies
```

**Cause** :
Les packages workspace (`database`, `platform-auth`, `supabase`) avaient des versions différentes de Next.js dans leurs `peerDependencies`.

**Solution** :
Alignement de tous les packages sur Next.js 15.1.0 (puis 15.5.9) :
- Root `package.json` : `"next": "15.1.0"`
- Tous les packages workspace : même version

**Statut** : ✅ Résolu

---

## Bug #4 : Dépendance react-hook-form manquante

**Date** : 19 octobre 2026  
**Commit** : `2c03ffc` - "fix: add missing react-hook-form dependency"

**Symptôme** :
```
Module not found: Can't resolve 'react-hook-form'
```

**Cause** :
Les composants de formulaire utilisaient `react-hook-form` mais la dépendance n'était pas déclarée dans `package.json`.

**Solution** :
Ajout de la dépendance :
```json
"react-hook-form": "^7.90.0"
```

**Statut** : ✅ Résolu

---

## Bug #5 : Build failures multiples (configuration incomplète)

**Date** : 19 octobre 2026  
**Commit** : `32ca7de` - "fix: comprehensive fixes for production deployment"

**Symptômes multiples** :
1. Tailwind CSS classes non générées
2. Workspace packages non compilés avant Next.js build
3. `DATABASE_URL` manquante causant des crashes Prisma

**Causes** :
1. Pas de `tailwind.config.ts` avec configuration complète
2. Build script ne compilait pas les packages workspace
3. Prisma client initialization sans gestion d'erreur

**Solutions** :
1. **Tailwind config** : Ajout de `tailwind.config.ts` avec theme complet
2. **Build script** : 
   ```json
   "build": "pnpm run build:packages && next build",
   "build:packages": "pnpm --filter @lineky/database run build && ..."
   ```
3. **Prisma init** : Gestion gracieuse de `DATABASE_URL` manquante au build
4. **vercel.json** : Build command mis à jour

**Statut** : ✅ Résolu

---

## Bug #6 : Protocole file: non supporté par Vercel

**Date** : 19 octobre 2026  
**Commit** : `5dcc953` - "fix: resolve workspace dependencies and build configuration"

**Symptôme** :
```
Error: Vercel does not support file: protocol for dependencies
Build failed: Cannot resolve local file dependencies
```

**Cause** :
Les dépendances workspace utilisaient le protocole `file:` :
```json
"@lineky/database": "file:./packages/database"
```

**Solution** :
Migration vers le protocole `workspace:*` :
```json
"@lineky/database": "workspace:*",
"@lineky/platform-auth": "workspace:*",
"@lineky/supabase": "workspace:*"
```

**Statut** : ✅ Résolu

---

## Bug #7 : Next.js 15.1.0 vulnérable (Vercel security block)

**Date** : 19 octobre 2026  
**Commit** : `65c49d6` - "fix: update Next.js to 15.5.9 to resolve Vercel security block"

**Symptôme** :
```
Error: Next.js 15.1.0 contains known security vulnerabilities
Deployment blocked by Vercel security policy
```

**Cause** :
Next.js 15.1.0 avait une vulnérabilité de sécurité connue. Vercel bloquait les déploiements avec cette version.

**Solution** :
1. Mise à jour vers Next.js 15.5.9 (version sécurisée)
2. Mise à jour `eslint-config-next` vers 15.5.9
3. Correction syntaxe CSS pour Tailwind v4 :
   - Suppression des `@theme inline` (non supporté en v4)
   - Vérification du build local : exit code 0

**Statut** : ✅ Résolu

---

## Bug #8 : CSRF token errors en production

**Date** : 19 octobre 2026  
**Commit** : `7f0eb24` - "fix: handle CSRF token error gracefully"

**Symptôme** :
```
Error: CSRF token not available
403 Forbidden: Invalid CSRF token
Page crash on initial load
```

**Cause** :
Le hook `useAdminCsrf` était appelé avant que le token soit disponible. Les composants essayaient de faire des requêtes avec un token null.

**Solution** :
1. Afficher un écran d'authentification quand le token n'est pas disponible
2. Détecter les réponses 401/403 et afficher un prompt de connexion
3. Ajouter un état de loading avant l'utilisation du token
4. Empêcher les appels `fetchWithCsrf` avant que le token soit prêt
5. Redirection vers `/auth/signin` pour authentification

**Statut** : ✅ Résolu

---

## Bug #9 : CSRF endpoint protégé (chicken-and-egg problem)

**Date** : 19 octobre 2026  
**Commits** : `c36b0d5`, `eee5be5`

**Symptôme** :
```
Error: Cannot get CSRF token - authentication required
401 Unauthorized on /api/admin/csrf-token
Infinite loop: need auth to get token, need token to auth
```

**Cause** :
L'endpoint `/api/admin/csrf-token` était protégé par `withAdminAuth`, mais le token CSRF était nécessaire pour s'authentifier. Problème circulaire.

**Solution** :
1. **Commit `c36b0d5`** : Tentative de passer le client Supabase à withAdminAuth
2. **Commit `eee5be5`** : **Solution finale** - Retrait de `withAdminAuth` sur l'endpoint CSRF
   - L'authentification est vérifiée lors de l'usage du token, pas lors de sa génération
   - Le token seul ne donne aucun accès sans session valide

**Statut** : ✅ Résolu

---

## Bug #10 : Force rebuild nécessaire pour déployer le fix CSRF

**Date** : 19 octobre 2026  
**Commit** : `7bd39f4` - "chore: force rebuild to deploy CSRF fix"

**Symptôme** :
Le fix CSRF ne se déployait pas, Vercel utilisait le cache.

**Cause** :
Vercel cache agressif sur les builds précédents.

**Solution** :
Commit vide pour forcer un nouveau build :
```bash
git commit --allow-empty -m "chore: force rebuild to deploy CSRF fix"
```

**Statut** : ✅ Résolu

---

## Bug #11 : Cache CSRF token non invalidé

**Date** : 19 octobre 2026  
**Commit** : `65935e0` - "fix(csrf): force cache bust with content change"

**Symptôme** :
Les anciens tokens CSRF étaient servis depuis le cache malgré les changements.

**Cause** :
Vercel/Browser cache non invalidé après les modifications de l'endpoint.

**Solution** :
Modification du contenu de la réponse pour forcer le cache bust :
```typescript
return NextResponse.json({ 
  token,
  message: 'CSRF token generated successfully' // Nouveau champ
});
```

**Statut** : ✅ Résolu

---

## Bug #12 : États confus dans useAdminCsrf (loading/error/noauth)

**Date** : 19 octobre 2026  
**Commit** : `8142863` - "fix(csrf): distinguish loading/error/noauth states in useAdminCsrf"

**Symptôme** :
```
Impossible de distinguer :
- Token en cours de chargement
- Erreur réseau
- Pas d'authentification
Tous affichaient "CSRF token not available"
```

**Cause** :
Le hook ne retournait qu'un état boolean `isLoading`, pas d'état `error` explicite.

**Solution** :
1. Ajout de l'état `error` dans `UseAdminCsrfReturn` :
   ```typescript
   interface UseAdminCsrfReturn {
     token: string | null
     isLoading: boolean
     error: Error | null  // Nouveau
     refreshToken: () => Promise<string | null>
     fetchWithCsrf: (url: string, options?: RequestInit) => Promise<Response>
   }
   ```
2. Mise à jour de `page.tsx` pour gérer 3 cas distincts :
   - **Loading** : Afficher spinner
   - **Network error** : Afficher erreur + bouton retry
   - **No token (403/401)** : Afficher "auth required" + bouton sign in

**Statut** : ✅ Résolu

---

## Bug #13 : Supabase client factory not provided

**Date** : 19 octobre 2026  
**Commit** : `83ff1e6` - "fix: resolve Supabase client factory initialization error in admin API routes"

**Symptôme** :
```
Error: Internal error: Supabase client factory not provided
500 Internal Server Error on all admin routes
```

**Cause** :
Le middleware `withAdminAuth` nécessitait une factory pour créer le client Supabase, mais elle n'était pas fournie. Le middleware ne pouvait pas vérifier la session.

**Solution** :
1. Ajouter l'import dans toutes les routes admin :
   ```typescript
   import { createClient as createSupabaseClient } from '@lineky/supabase/server'
   ```
2. Passer la factory comme 3e paramètre à `withAdminAuth` :
   ```typescript
   export const GET = withAdminAuth(
     async (_req: NextRequest) => { /* ... */ },
     createSupabaseClient  // 3e paramètre
   )
   ```
3. Mise à jour des 15+ routes admin :
   - `/api/admin/overview`
   - `/api/admin/admins`
   - `/api/admin/analytics`
   - `/api/admin/billing`
   - `/api/admin/users`
   - `/api/admin/workspaces`
   - etc.

**Statut** : ✅ Résolu

---

## Bug #14 : Page signin manquante

**Date** : 19 octobre 2026  
**Commit** : `32be428` - "feat: add professional signin page with Supabase authentication"

**Symptôme** :
```
404 Not Found: /auth/signin
Cannot authenticate to access admin panel
```

**Cause** :
Aucune page d'authentification n'existait. L'application demandait une authentification mais ne fournissait pas de moyen de se connecter.

**Solution** :
1. **Création de `/auth/signin/page.tsx`** :
   - Interface moderne avec gradient background
   - Formulaire email/password
   - Intégration Supabase Auth
   - Validation emails admin via `NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS`
   - États de chargement et messages d'erreur
   - Redirection automatique après connexion

2. **Création de `/auth/callback/route.ts`** :
   - Handler OAuth callback
   - Échange code → session
   - Redirection vers dashboard

3. **Variable d'environnement** :
   - Ajout de `NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS` dans `.env.local`
   - Configuration sur Vercel

**Statut** : ✅ Résolu

---

## Bug #15 : Erreurs TypeScript dans les pages auth

**Date** : 19 octobre 2026  
**Commit** : `1465aa1` - "fix: resolve build errors in auth pages"

**Symptômes** :
```
Error: Cannot find name 'createBrowserClient'
Error: Type 'SupabaseClient' is not awaitable
Build failed with 2 TypeScript errors
```

**Causes** :
1. Import incorrect : `createBrowserClient` n'existe pas dans `@lineky/supabase/client`
2. `createClient()` retourne une Promise mais n'était pas awaité

**Solutions** :
1. **Signin page** : Correction de l'import
   ```typescript
   // Avant
   import { createBrowserClient } from '@lineky/supabase/client'
   
   // Après
   import { createClient } from '@lineky/supabase/client'
   ```

2. **Callback route** : Ajout de await
   ```typescript
   // Avant
   const supabase = createClient()
   
   // Après
   const supabase = await createClient()
   ```

3. **Vérification** : Build local avec exit code 0

**Statut** : ✅ Résolu

---

## Résumé des bugs

| # | Type | Severité | Temps résolution |
|---|------|----------|------------------|
| 1 | Build | Haute | 30 min |
| 2 | Build | Moyenne | 15 min |
| 3 | Dependencies | Moyenne | 20 min |
| 4 | Dependencies | Basse | 5 min |
| 5 | Build | Haute | 1h |
| 6 | Build | Haute | 30 min |
| 7 | Security | Critique | 30 min |
| 8 | Runtime | Haute | 45 min |
| 9 | Architecture | Critique | 1h |
| 10 | Deploy | Basse | 5 min |
| 11 | Cache | Moyenne | 15 min |
| 12 | UX | Moyenne | 30 min |
| 13 | Runtime | Critique | 1h |
| 14 | Feature | Haute | 2h |
| 15 | Build | Moyenne | 20 min |

**Total bugs** : 15  
**Temps total résolution** : ~8h  
**Bugs critiques** : 3  
**Bugs de build** : 7  
**Bugs runtime** : 3  

---

## Patterns de bugs identifiés

### 1. Build Configuration
- Configuration incomplète (Tailwind, workspace packages)
- Protocoles de dépendances incorrects
- Ordre de build incorrect

### 2. Authentication & Security
- Problèmes circulaires (CSRF + auth)
- Vulnérabilités de dépendances
- États d'authentification mal gérés

### 3. Dependency Injection
- Factory patterns non implémentés
- Imports manquants ou incorrects
- Peer dependencies désalignées

### 4. TypeScript Errors
- Imports incorrects
- Promesses non awaitées
- Types manquants

---

## Leçons apprises

1. **Toujours vérifier les versions** : Aligner Next.js, React, et peer deps
2. **Tester les builds localement** : Avant de push sur Vercel
3. **Workspace protocol** : Utiliser `workspace:*` pour monorepos sur Vercel
4. **CSRF patterns** : Ne jamais protéger l'endpoint de génération de token
5. **Dependency injection** : Passer les factories explicitement aux middlewares
6. **États frontend** : Distinguer loading/error/success clairement
7. **TypeScript strict** : Aide à détecter les erreurs avant le runtime
8. **Documentation** : Documenter les décisions architecturales complexes
