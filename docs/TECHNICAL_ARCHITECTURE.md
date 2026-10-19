# TECHNICAL_ARCHITECTURE.md

## Stack technique

### Framework & Runtime
- **Next.js** : 15.5.9 (App Router)
- **React** : 19.0.0
- **Node.js** : 24.x (Vercel runtime)
- **TypeScript** : 5.x (strict mode)

### UI & Styling
- **Tailwind CSS** : v4 (avec @tailwindcss/postcss)
- **Radix UI** : Collection complète de composants primitifs
  - Accordion, Alert Dialog, Avatar, Checkbox, Dialog
  - Dropdown Menu, Navigation Menu, Popover, Select
  - Tabs, Toast, Tooltip, et plus
- **Lucide React** : 0.468.0 (icônes)
- **next-themes** : 0.4.4 (dark mode)
- **class-variance-authority** : 0.7.1 (variants de composants)
- **tailwind-merge** : 2.6.0 (fusion de classes)
- **tailwindcss-animate** : 1.0.7 (animations)

### Base de données & ORM
- **PostgreSQL** : Base de données principale
- **Prisma** : 5.x (ORM)
- **@lineky/database** : Package workspace pour le client Prisma

### Authentification
- **Supabase Auth** : Authentification principale
- **@lineky/platform-auth** : Package workspace pour auth middleware
- **@lineky/supabase** : Package workspace pour clients Supabase
- **CSRF Protection** : Tokens générés pour toutes les mutations admin

### Formulaires & Validation
- **react-hook-form** : 7.90.0 (gestion de formulaires)
- **zod** : 3.24.1 (validation de schémas)

### Internationalisation
- **next-intl** : 4.14.9 (i18n avec support de 7 langues)
- Langues supportées : en, fr, de, es, it, nl, sv

### Graphiques & Visualisation
- **recharts** : 2.15.0 (charts et graphiques)

### Utilitaires
- **date-fns** : 4.1.0 (manipulation de dates)
- **qrcode** : 1.5.4 (génération QR codes pour 2FA)
- **otplib** : 13.5.0 (TOTP pour 2FA)
- **nodemailer** : 10.1.7 (emails)
- **resend** : 6.34.1 (service email)
- **sonner** : 1.7.3 (notifications toast)

### Testing
- **Jest** : 29.7.0
- **@types/jest** : 29.5.14
- **jest-environment-jsdom** : 29.7.0
- **ts-jest** : 29.2.5

### Package Manager
- **pnpm** : Workspace monorepo

---

## Structure du projet

```
control-lineky/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # API Routes
│   │   │   └── admin/              # Admin API endpoints
│   │   │       ├── csrf-token/     # CSRF token generation
│   │   │       ├── overview/       # Dashboard stats
│   │   │       ├── users/          # User management
│   │   │       ├── workspaces/     # Workspace management
│   │   │       ├── admins/         # Admin management
│   │   │       ├── analytics/      # Analytics data
│   │   │       ├── billing/        # Billing & subscriptions
│   │   │       ├── announcements/  # Platform announcements
│   │   │       ├── audit-logs/     # Audit trail
│   │   │       ├── feature-flags/  # Feature flags
│   │   │       ├── security/       # Security settings (2FA, IP)
│   │   │       ├── support-tickets/# Support tickets
│   │   │       └── system-config/  # System configuration
│   │   ├── auth/                   # Authentication pages
│   │   │   ├── signin/             # Sign in page
│   │   │   └── callback/           # OAuth callback
│   │   ├── layout.tsx              # Root layout
│   │   └── page.tsx                # Home page
│   │
│   ├── components/                 # React components
│   │   ├── admin/                  # Admin-specific components
│   │   └── ui/                     # Reusable UI components
│   │
│   ├── hooks/                      # Custom React hooks
│   │   └── use-admin-csrf.ts       # CSRF token management
│   │
│   ├── i18n/                       # Internationalization
│   │   ├── request.ts              # i18n config
│   │   └── locales/                # Translation files
│   │       ├── en/
│   │       ├── fr/
│   │       ├── de/
│   │       ├── es/
│   │       ├── it/
│   │       ├── nl/
│   │       └── sv/
│   │
│   ├── lib/                        # Utilities
│   │   ├── logger.ts               # Logging utility
│   │   ├── utils.ts                # General utilities
│   │   └── monitoring/             # Monitoring utilities
│   │
│   └── services/                   # Business logic services
│
├── packages/                       # Workspace packages
│   ├── database/                   # Database package
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Database schema
│   │   │   └── migrations/         # Database migrations
│   │   ├── src/
│   │   │   └── index.ts            # Prisma client export
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── platform-auth/              # Authentication package
│   │   ├── src/
│   │   │   ├── admin-guard.ts      # Admin authorization middleware
│   │   │   ├── platform-admin.ts   # Admin detection logic
│   │   │   ├── platform-permissions.ts # Permission system
│   │   │   ├── csrf.ts             # CSRF utilities
│   │   │   └── audit/
│   │   │       └── admin.ts        # Audit logging
│   │   ├── __tests__/              # Unit tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── supabase/                   # Supabase package
│       ├── src/
│       │   ├── server.ts           # Server-side client
│       │   ├── client.ts           # Client-side client
│       │   └── middleware.ts       # Middleware client
│       ├── package.json
│       └── tsconfig.json
│
├── public/                         # Static assets
├── __tests__/                      # App-level tests
├── __mocks__/                      # Test mocks
│
├── .env.local                      # Environment variables (local)
├── .gitignore                      # Git ignore rules
├── next.config.ts                  # Next.js configuration
├── tailwind.config.ts              # Tailwind configuration
├── tsconfig.json                   # TypeScript configuration
├── jest.config.ts                  # Jest configuration
├── vercel.json                     # Vercel deployment config
├── pnpm-workspace.yaml             # pnpm workspace config
└── package.json                    # Root package.json
```

---

## Routes API

Toutes les routes admin sont protégées par `withAdminAuth` middleware.

### Authentication

#### POST /api/admin/csrf-token
Génère un token CSRF pour les requêtes authentifiées.
- **Auth** : Non requise (token utilisé ensuite)
- **Response** : `{ token: string, message: string }`

### Dashboard

#### GET /api/admin/overview
Statistiques globales de la plateforme.
- **Auth** : Admin
- **Response** : Stats (workspaces, users, deals, MRR, etc.)

### User Management

#### GET /api/admin/users
Liste tous les utilisateurs avec leurs workspaces et rôles.
- **Auth** : Admin
- **Response** : Array d'utilisateurs avec memberships

#### PATCH /api/admin/users
Actions sur un utilisateur (toggle-active, invite).
- **Auth** : Admin
- **Body** : `{ action: string, userId?: string, email?: string }`

### Workspace Management

#### GET /api/admin/workspaces
Liste tous les workspaces avec leurs plans et stats.
- **Auth** : Admin
- **Response** : Array de workspaces

#### PATCH /api/admin/workspaces
Actions sur un workspace (suspend, resume, upgrade, etc.).
- **Auth** : Admin
- **Body** : `{ action: string, workspaceId: string, ... }`

### Admin Management

#### GET /api/admin/admins
Liste tous les administrateurs plateforme.
- **Auth** : Super admin
- **Response** : Array de PlatformAdmin

#### POST /api/admin/admins
Créer un nouvel admin plateforme.
- **Auth** : Super admin
- **Body** : `{ email: string, role: string }`

#### PATCH /api/admin/admins
Mettre à jour un admin (role, status).
- **Auth** : Super admin

### Analytics

#### GET /api/admin/analytics
Données analytics de la plateforme.
- **Auth** : Admin
- **Query** : `period` (7d, 30d, 90d, 1y)
- **Response** : Charts data, métriques

#### GET /api/admin/analytics/export-pdf
Exporte les analytics en PDF.
- **Auth** : Admin
- **Response** : PDF file

### Billing

#### GET /api/admin/billing
Informations de facturation et abonnements.
- **Auth** : Admin
- **Response** : Subscriptions, transactions, MRR

### Announcements

#### GET /api/admin/announcements
Liste les annonces plateforme.
- **Auth** : Admin
- **Response** : Array d'announcements

#### POST /api/admin/announcements
Créer une nouvelle annonce.
- **Auth** : Admin
- **Body** : `{ title: string, content: string, ... }`

### Audit Logs

#### GET /api/admin/audit-logs
Logs d'audit des actions admin.
- **Auth** : Admin
- **Query** : `limit`, `offset`, `adminId`, `action`
- **Response** : Array de logs avec pagination

### Feature Flags

#### GET /api/admin/feature-flags
Liste les feature flags.
- **Auth** : Admin
- **Response** : Array de flags

#### PATCH /api/admin/feature-flags
Toggle un feature flag.
- **Auth** : Admin
- **Body** : `{ flag: string, enabled: boolean }`

### Security

#### GET /api/admin/security/2fa
Configuration 2FA pour l'admin connecté.
- **Auth** : Admin
- **Response** : `{ enabled: boolean, qrCodeUrl?: string }`

#### POST /api/admin/security/2fa
Enable/disable 2FA.
- **Auth** : Admin
- **Body** : `{ action: 'enable' | 'disable', code?: string }`

#### GET /api/admin/security/ip-whitelist
Liste des IPs whitelistées pour l'admin.
- **Auth** : Admin
- **Response** : `{ allowedIps: string[] }`

#### PATCH /api/admin/security/ip-whitelist
Met à jour la whitelist IP.
- **Auth** : Admin
- **Body** : `{ allowedIps: string[] }`

### Support

#### GET /api/admin/support-tickets
Liste les tickets de support.
- **Auth** : Admin
- **Response** : Array de tickets

### System Config

#### GET /api/admin/system-config
Configuration système.
- **Auth** : Super admin
- **Response** : Config object

#### PATCH /api/admin/system-config
Met à jour la configuration système.
- **Auth** : Super admin
- **Body** : Config updates

#### POST /api/admin/system-config/test-email
Envoie un email de test.
- **Auth** : Admin
- **Body** : `{ to: string }`

---

## Base de données

### Schéma Prisma principal

#### User
Utilisateur CRM lié à Supabase Auth.
- `id` : CUID
- `authUserId` : UUID Supabase (unique)
- `email` : Email (unique)
- `fullName` : Nom complet
- `avatarUrl` : URL avatar
- `isActive` : Status actif
- Relations : `memberships`, `contacts`, `deals`, etc.

#### PlatformAdmin
Administrateur plateforme.
- `id` : CUID
- `email` : Email (unique)
- `role` : super_admin | billing_admin | support_admin
- `isActive` : Status actif
- `twoFactorEnabled` : 2FA activé
- `twoFactorSecret` : Secret TOTP
- `allowedIps` : JSON liste d'IPs
- Relations : `auditLogs`

#### Workspace
Espace de travail client.
- `id` : CUID
- `slug` : Slug unique
- `name` : Nom
- `plan` : free | starter | pro | enterprise
- Relations : `memberships`, `subscriptions`, `contacts`, etc.

#### Subscription
Abonnement d'un workspace.
- `id` : CUID
- `workspaceId` : FK Workspace
- `planId` : FK Plan
- `status` : active | trialing | past_due | canceled
- `currentPeriodStart` : Date début période
- `currentPeriodEnd` : Date fin période

#### AdminAuditLog
Logs d'audit des actions admin.
- `id` : CUID
- `adminId` : FK PlatformAdmin
- `action` : Type d'action
- `targetType` : Type de cible
- `targetId` : ID de la cible
- `metadata` : JSON metadata
- `ipAddress` : IP source

---

## Authentification

### Flow Supabase

1. **Sign in** : User visite `/auth/signin`
2. **Email/Password** : Formulaire avec validation
3. **Supabase Auth** : Appel à `supabase.auth.signInWithPassword()`
4. **Email validation** : Vérification contre `NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS`
5. **Redirection** : Vers `/auth/callback` avec code
6. **Session exchange** : Callback échange le code contre une session
7. **Redirection finale** : Vers `/` (dashboard)

### CSRF Protection

1. **Token generation** : GET `/api/admin/csrf-token`
2. **Cookie** : Token stocké dans `__Host-csrf-token` cookie
3. **Response** : Token également retourné en JSON
4. **Usage** : Header `x-csrf-token` sur toutes les mutations
5. **Validation** : Middleware vérifie cookie vs header
6. **Expiration** : 1 heure, refresh automatique

### Middleware Admin (`withAdminAuth`)

Protection des routes API admin :

1. **Session check** : Vérifie la session Supabase (401 si manquante)
2. **Admin check** : Vérifie via `checkPlatformAdmin()` (403 si pas admin)
3. **Permission check** : Vérifie les permissions requises (403 si denied)
4. **CSRF check** : Valide le token CSRF sur mutations (403 si invalide)
5. **Audit log** : Log l'action admin si succès
6. **Error handling** : Log les échecs d'auth

### Permissions

Système de permissions hiérarchique :

- **super_admin** : Toutes les permissions
- **billing_admin** : Gestion billing, abonnements, plans
- **support_admin** : Gestion support, tickets, announcements

Permissions granulaires :
- `view_users`, `manage_users`
- `view_workspaces`, `manage_workspaces`
- `view_billing`, `manage_billing`
- `view_analytics`, `export_analytics`
- `manage_admins` (super_admin uniquement)
- `manage_system_config` (super_admin uniquement)

---

## Frontend Architecture

### Hook useAdminCsrf

Hook central pour la gestion CSRF :

```typescript
const { token, fetchWithCsrf, isLoading, error, refreshToken } = useAdminCsrf()
```

**États** :
- `isLoading` : true pendant le fetch initial
- `error` : Error si échec du fetch
- `token` : Token CSRF (null si pas disponible)

**Méthodes** :
- `refreshToken()` : Rafraîchit le token
- `fetchWithCsrf(url, options)` : Wrapper fetch avec token automatique

**Logique** :
- Fetch initial au mount
- Retry automatique sur 403 CSRF
- Error handling pour cas réseau vs auth

### Composants UI

Tous basés sur Radix UI primitives + Tailwind :

- **Button** : Variants (default, destructive, outline, ghost, link)
- **Input** : Text inputs avec validation
- **Select** : Dropdowns avec recherche
- **Dialog** : Modals avec overlay
- **Toast** : Notifications via sonner
- **Table** : Tables responsives avec tri
- **Card** : Conteneurs avec header/footer
- **Tabs** : Navigation par onglets

---

## Déploiement

### Build Process

1. **Install** : `pnpm install`
2. **Build packages** : `pnpm run build:packages`
   - Compile `@lineky/database`
   - Compile `@lineky/platform-auth`
   - Compile `@lineky/supabase`
3. **Generate Prisma** : `postinstall` hook
4. **Build Next.js** : `next build`
5. **Output** : `.next` directory

### Vercel Configuration

- **Framework** : Next.js
- **Node version** : 24.x
- **Root directory** : /
- **Build command** : `pnpm run build:packages && pnpm run build`
- **Install command** : `pnpm install`
- **Output directory** : `.next`

### Environment Variables

Required in Vercel :
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PLATFORM_ADMIN_EMAILS`
- `NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS`

---

## Performance

- **SSR** : Server-side rendering pour SEO
- **API Routes** : `force-dynamic` pour données temps réel
- **React 19** : Optimisations automatiques
- **Code splitting** : Automatique par Next.js
- **Image optimization** : Via `next/image`
- **Bundle size** : Optimisé avec tree shaking

---

## Sécurité

- ✅ CSRF protection sur toutes les mutations
- ✅ SQL injection protection (Prisma ORM)
- ✅ XSS protection (React auto-escape)
- ✅ Rate limiting (à implémenter)
- ✅ 2FA TOTP support
- ✅ IP whitelisting support
- ✅ Audit logging
- ✅ Secure cookies (`__Host-` prefix)
- ✅ HTTPS only (Vercel)
