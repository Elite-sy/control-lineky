# PROJECT_HISTORY.md

## Vue d'ensemble du projet

**Nom** : Lineky Admin Control Panel  
**Repository** : `Elite-sy/control-lineky`  
**Objectif** : Panneau d'administration séparé du CRM principal pour gérer la plateforme Lineky  
**Architecture** : Application Next.js 15.5.9 standalone avec workspace packages  
**Déploiement** : Vercel (https://control-lineky-teal.vercel.app)  
**Status actuel** : ✅ En production

---

## Phase 1 : Planification initiale

**Date** : Octobre 2026  
**Décision d'architecture** : Création d'un repository séparé plutôt qu'un sous-projet du monorepo CRM-FACTORY

### Objectifs définis

1. Créer un panneau d'administration platform-level séparé du CRM
2. Gérer les utilisateurs, workspaces, abonnements et configurations système
3. Fournir des analytics et monitoring de la plateforme
4. Implémenter une authentification sécurisée avec Supabase Auth
5. Déployer sur Vercel avec un domaine dédié

### Stack technique choisie

- **Framework** : Next.js 15.5.9 (avec App Router)
- **Language** : TypeScript 5
- **UI** : React 19 + Radix UI + Tailwind CSS v4
- **Base de données** : PostgreSQL via Prisma ORM
- **Authentification** : Supabase Auth
- **Package Manager** : pnpm avec workspace
- **CI/CD** : Vercel
- **Testing** : Jest + React Testing Library

---

## Phase 2 : Création du repository

**Date** : 19 octobre 2026  
**Commit initial** : `2fe7959` - "feat: initial commit - Lineky admin control panel"

### Actions effectuées

1. **Création du repository GitHub** : `Elite-sy/control-lineky`
2. **Migration du code** depuis `CRM-FACTORY/apps/control/`
3. **Copie des packages partagés** :
   - `@lineky/database` - Prisma client + models
   - `@lineky/platform-auth` - Middleware d'authentification admin
   - `@lineky/supabase` - Configuration clients Supabase
4. **Configuration workspace pnpm** :
   - `pnpm-workspace.yaml` définissant les packages
   - `package.json` avec protocole `workspace:*` pour les dépendances locales
5. **Structure initiale** :
   ```
   control-lineky/
   ├── src/app/              # Routes Next.js
   ├── src/components/       # Composants React
   ├── src/hooks/           # Custom hooks
   ├── src/lib/             # Utilitaires
   ├── packages/
   │   ├── database/        # Prisma + schema
   │   ├── platform-auth/   # Auth guards
   │   └── supabase/        # Supabase clients
   └── public/              # Assets statiques
   ```

---

## Phase 3 : Configuration initiale

**Commits** : `2fe7959` → `929af51`

### 3.1 Configuration Next.js

- **next.config.ts** :
  - Transpilation des packages workspace
  - Intégration `next-intl` pour i18n
  - Configuration `serverActions` avec limite 2MB
- **tsconfig.json** : Configuration TypeScript strict
- **App Router** : Structure `/app` avec routes API et pages

### 3.2 Configuration Tailwind CSS v4

- **tailwind.config.ts** : Configuration complète du theme
- **@tailwindcss/postcss** : PostCSS plugin v4
- **Tokens de couleurs** : Thème complet avec dark mode
- Migration des classes pour compatibilité v4

### 3.3 Configuration Vercel

- **vercel.json** :
  ```json
  {
    "buildCommand": "pnpm run build:packages && pnpm run build",
    "installCommand": "pnpm install",
    "framework": "nextjs",
    "outputDirectory": ".next"
  }
  ```
- **Build en deux étapes** :
  1. `pnpm run build:packages` - Compile les packages workspace
  2. `next build` - Build Next.js

### 3.4 Variables d'environnement

Variables requises :
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL` - URL du projet Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Clé anonyme Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Clé service role
- `PLATFORM_ADMIN_EMAILS` - Liste des emails admin (comma-separated)
- `NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS` - Version publique pour validation client

---

## Phase 4 : Corrections et optimisations

Cette phase a nécessité 16 commits de corrections entre le 19 octobre 2026.

### 4.1 Configuration Prisma (`929af51`, `ce3ba7f`)

**Problème** : Prisma client non généré sur Vercel  
**Solution** :
- Ajout du script `postinstall` : `cd packages/database && npx prisma generate`
- Configuration Prisma pour gérer `DATABASE_URL` manquante au build time
- Génération du client dans le bon package workspace

### 4.2 Versions Next.js (`527980c`)

**Problème** : Versions Next.js incohérentes entre packages  
**Solution** : Alignement de tous les packages sur Next.js 15.1.0 (puis 15.5.9)

### 4.3 Dépendances manquantes (`2c03ffc`)

**Problème** : `react-hook-form` manquant  
**Solution** : Ajout de la dépendance dans package.json principal

### 4.4 Build configuration complète (`32ca7de`)

**Problème** : Build failures multiples sur Vercel  
**Corrections** :
- Ajout de `tailwind.config.ts` avec configuration complète
- Script `build:packages` dans package.json
- Correction de la commande build dans vercel.json
- Gestion de `DATABASE_URL` manquante pendant le build

### 4.5 Dépendances workspace (`5dcc953`)

**Problème** : Protocole `file:` non supporté par Vercel  
**Solution** : Migration vers `workspace:*` protocol

### 4.6 Mise à jour Next.js sécurisée (`65c49d6`)

**Problème** : Vercel bloquait Next.js 15.1.0 (vulnérabilité de sécurité)  
**Solution** :
- Mise à jour vers Next.js 15.5.9
- Mise à jour `eslint-config-next` vers 15.5.9
- Correction syntaxe CSS pour Tailwind v4

---

## Phase 5 : Authentification et CSRF

**Commits** : `7f0eb24` → `1465aa1`

### 5.1 Gestion CSRF token (`7f0eb24`)

**Problème** : Erreurs CSRF token sur les requêtes admin  
**Solution** :
- Hook `useAdminCsrf` pour gérer les tokens
- Écran d'authentification quand token indisponible
- Détection 401/403 pour rediriger vers signin
- États de loading avant utilisation du token

### 5.2 Configuration endpoint CSRF (`c36b0d5`, `eee5be5`)

**Problème** : Endpoint CSRF nécessitait auth (chicken-and-egg)  
**Solution** : Retrait de `withAdminAuth` sur `/api/admin/csrf-token`

### 5.3 Gestion états du hook (`8142863`)

**Problème** : Confusion entre loading, error et noauth  
**Solution** :
- État `error` explicite dans `UseAdminCsrfReturn`
- Distinction claire des 3 cas :
  1. Loading : spinner
  2. Network error : erreur + retry
  3. No token : auth required + sign in button

### 5.4 Correction Supabase client factory (`83ff1e6`)

**Problème** : "Internal error: Supabase client factory not provided"  
**Solution** :
- Ajout de `createClient` import dans toutes les routes admin
- Passage de `createSupabaseClient` comme 3e paramètre à `withAdminAuth`
- Mise à jour des 15+ routes admin

### 5.5 Création page signin (`32be428`)

**Date** : 19 octobre 2026  
**Fichiers créés** :
- `src/app/auth/signin/page.tsx` - Page d'authentification
- `src/app/auth/callback/route.ts` - OAuth callback handler

**Fonctionnalités** :
- Interface moderne avec gradient background
- Intégration Supabase Auth (email/password)
- Validation emails admin via `NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS`
- États de chargement et messages d'erreur
- Redirection automatique après connexion

### 5.6 Corrections build auth (`1465aa1`)

**Problème** : Erreurs TypeScript dans les pages auth  
**Solution** :
- Import correct : `createClient` au lieu de `createBrowserClient`
- Await sur `createClient()` dans callback (retourne Promise)
- Vérification build local avec exit code 0

---

## Phase 6 : Déploiement et stabilisation

**Status** : ✅ Production stable  
**URL** : https://control-lineky-teal.vercel.app  
**Dernier déploiement réussi** : 19 octobre 2026, 22:19

### Résumé des déploiements

- **Total commits** : 18
- **Déploiements Vercel** : ~20+
- **Issues résolues** : 12 majeures
- **Build time** : ~2-3 minutes
- **Routes API** : 16 endpoints admin

### Monitoring

- Logs Vercel pour les erreurs runtime
- Analytics Vercel pour le trafic
- Prisma logs pour les requêtes DB
- Custom logger pour debug

### Sécurité

- ✅ CSRF protection sur toutes les routes mutantes
- ✅ Admin authentication via Supabase
- ✅ Email validation pour les admins
- ✅ IP whitelist support (DB)
- ✅ 2FA TOTP support (DB)
- ✅ Audit logging pour actions admin

---

## Statistiques du projet

- **Durée totale** : 1 journée (19 octobre 2026)
- **Commits** : 18
- **Fichiers créés** : 150+
- **Lignes de code** : ~5000+
- **Routes API** : 16
- **Composants React** : 30+
- **Tests** : 2 suites (audit-admin, permissions)
- **Packages workspace** : 3

---

## Leçons apprises

1. **Workspace packages** : Le protocole `workspace:*` est essentiel pour Vercel
2. **Prisma generation** : Doit être dans `postinstall` pour les builds Vercel
3. **Next.js versions** : Rester à jour pour les patches de sécurité
4. **CSRF tokens** : Ne pas protéger l'endpoint de génération de token
5. **Supabase factory** : Passer explicitement aux middleware pour éviter les erreurs
6. **Build en deux étapes** : Compiler les packages avant Next.js
7. **TypeScript strict** : Aide à détecter les erreurs avant le runtime

---

## Prochaines étapes

1. Ajouter des tests E2E avec Playwright
2. Implémenter rate limiting sur les routes admin
3. Ajouter monitoring avancé (Sentry, LogRocket)
4. Créer un dashboard de métriques temps réel
5. Documenter tous les endpoints API
6. Ajouter CI/CD avec tests automatiques
7. Configurer le domaine custom control.lineky.com
