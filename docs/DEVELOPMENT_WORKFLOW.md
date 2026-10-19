# DEVELOPMENT_WORKFLOW.md

Guide pour les développeurs travaillant sur le projet control-lineky.

---

## Setup local

### 1. Prérequis

- **Node.js** : v20.x ou v24.x (recommandé)
- **pnpm** : v8.x ou supérieur
- **Git** : Pour le versioning
- **IDE** : VS Code recommandé avec extensions :
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - Prisma

### 2. Installation

```bash
# Cloner le repository
git clone https://github.com/Elite-sy/control-lineky.git
cd control-lineky

# Installer pnpm si nécessaire
npm install -g pnpm

# Installer les dépendances
pnpm install

# Le postinstall génère automatiquement le client Prisma
```

### 3. Configuration

#### Variables d'environnement

Créer `.env.local` à la racine :

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/lineky_dev"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Admin emails
PLATFORM_ADMIN_EMAILS="your-email@example.com"
NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS="your-email@example.com"
```

#### Base de données locale

Option 1 : Utiliser Supabase (recommandé pour dev)
```bash
# La DATABASE_URL pointe vers votre projet Supabase
# Pas besoin de setup local
```

Option 2 : PostgreSQL local
```bash
# Installer PostgreSQL
# Créer une base de données
createdb lineky_dev

# Appliquer les migrations
cd packages/database
npx prisma migrate dev
```

### 4. Lancer le projet

```bash
# Mode développement (port 3001)
pnpm dev

# Ouvrir dans le navigateur
open http://localhost:3001
```

---

## Commandes disponibles

### Développement

```bash
# Démarrer le serveur de dev (port 3001)
pnpm dev

# Build production
pnpm build

# Lancer en mode production
pnpm start

# Linter
pnpm lint

# Type checking
pnpm typecheck
```

### Tests

```bash
# Lancer tous les tests
pnpm test

# Mode watch (re-run automatique)
pnpm test:watch

# Tests spécifiques
pnpm test packages/platform-auth
```

### Database (depuis packages/database)

```bash
cd packages/database

# Créer une migration
npx prisma migrate dev --name add_new_feature

# Appliquer les migrations
npx prisma migrate deploy

# Réinitialiser la DB (⚠️ perte de données)
npx prisma migrate reset

# Ouvrir Prisma Studio (DB GUI)
npx prisma studio

# Générer le client Prisma
npx prisma generate

# Formatter le schema
npx prisma format
```

### Packages workspace

```bash
# Build tous les packages
pnpm run build:packages

# Build un package spécifique
pnpm --filter @lineky/database run build
pnpm --filter @lineky/platform-auth run build
pnpm --filter @lineky/supabase run build

# Ajouter une dépendance à un package
pnpm --filter @lineky/database add some-package
```

---

## Conventions de code

### Structure des fichiers

```typescript
// 1. Imports externes
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// 2. Imports internes (packages)
import { db } from '@lineky/database'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'

// 3. Imports locaux
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/types'

// 4. Types et interfaces
interface UserData {
  id: string
  email: string
}

// 5. Constantes
const MAX_RETRIES = 3

// 6. Code principal
export async function GET(req: NextRequest) {
  // ...
}
```

### Naming conventions

- **Fichiers** : kebab-case (`user-profile.tsx`, `api-client.ts`)
- **Composants** : PascalCase (`UserProfile.tsx`, `AdminDashboard.tsx`)
- **Functions** : camelCase (`getUserById`, `fetchWithCsrf`)
- **Constants** : UPPER_SNAKE_CASE (`API_BASE_URL`, `MAX_RETRIES`)
- **Types/Interfaces** : PascalCase (`UserProfile`, `ApiResponse`)
- **CSS classes** : Tailwind (pas de fichiers CSS customs)

### TypeScript

```typescript
// ✅ Bon : Types explicites pour les paramètres et retours
async function getUser(id: string): Promise<User | null> {
  return db.user.findUnique({ where: { id } })
}

// ❌ Mauvais : any
async function getUser(id: any): Promise<any> {
  return db.user.findUnique({ where: { id } })
}

// ✅ Bon : Interfaces pour les objets
interface CreateUserInput {
  email: string
  fullName: string
}

// ✅ Bon : Types pour les unions
type UserRole = 'admin' | 'user' | 'guest'
```

### React Components

```typescript
// ✅ Bon : Composant avec types
interface ButtonProps {
  children: React.ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded',
        variant === 'primary' && 'bg-blue-500 text-white',
        variant === 'secondary' && 'bg-gray-200 text-gray-800'
      )}
    >
      {children}
    </button>
  )
}
```

### API Routes

```typescript
// ✅ Bon : Route avec middleware, validation, error handling
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@lineky/platform-auth/admin-guard'
import { createClient } from '@lineky/supabase/server'
import { db } from '@lineky/database'
import { z } from 'zod'

// Configuration Next.js
export const dynamic = 'force-dynamic'

// Schéma de validation
const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
})

// Handler avec middleware
export const POST = withAdminAuth(
  async (req: NextRequest) => {
    try {
      // Parse et valide le body
      const body = await req.json()
      const data = createUserSchema.parse(body)

      // Business logic
      const user = await db.user.create({
        data: {
          email: data.email,
          fullName: data.fullName,
          authUserId: crypto.randomUUID(),
        },
      })

      // Response
      return NextResponse.json({
        success: true,
        data: user,
      })
    } catch (error) {
      // Error handling
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, errors: error.errors },
          { status: 400 }
        )
      }
      
      console.error('Error creating user:', error)
      return NextResponse.json(
        { success: false, message: 'Internal error' },
        { status: 500 }
      )
    }
  },
  createClient
)
```

### Commentaires

```typescript
// ✅ Bon : Commentaires utiles expliquant le "pourquoi"
// Rate limit to 10 requests per minute to prevent abuse
const rateLimiter = new RateLimiter({ max: 10, window: 60000 })

// ✅ Bon : JSDoc pour les fonctions publiques
/**
 * Fetches a user by ID with their memberships.
 * 
 * @param id - User ID (CUID)
 * @returns User with memberships or null if not found
 */
export async function getUserById(id: string): Promise<UserWithMemberships | null> {
  // ...
}

// ❌ Mauvais : Commentaires qui répètent le code
// Set isActive to true
user.isActive = true
```

---

## Git workflow

### Branches

- `main` : Production, toujours stable
- `develop` : Développement, intégration continue (optionnel)
- `feature/xxx` : Nouvelles fonctionnalités
- `fix/xxx` : Bug fixes
- `chore/xxx` : Maintenance, refactoring

### Workflow

```bash
# 1. Créer une branche depuis main
git checkout main
git pull origin main
git checkout -b feature/add-user-export

# 2. Développer et commiter
git add .
git commit -m "feat(users): add CSV export functionality"

# 3. Push la branche
git push origin feature/add-user-export

# 4. Créer une Pull Request sur GitHub
# 5. Après review et merge, supprimer la branche
git checkout main
git pull origin main
git branch -d feature/add-user-export
```

### Commit messages

Format : `type(scope): description`

**Types** :
- `feat` : Nouvelle fonctionnalité
- `fix` : Bug fix
- `docs` : Documentation
- `style` : Formatting, pas de changement de code
- `refactor` : Refactoring de code
- `test` : Ajout de tests
- `chore` : Maintenance, config

**Exemples** :
```bash
feat(auth): add 2FA support for platform admins
fix(csrf): handle token expiration gracefully
docs(api): add documentation for user endpoints
refactor(db): optimize workspace queries
test(auth): add unit tests for admin guard
chore(deps): update Next.js to 15.5.9
```

### Pull Requests

**Template de PR** :

```markdown
## Description
Brief description of what this PR does.

## Changes
- Added X feature
- Fixed Y bug
- Refactored Z module

## Testing
- [ ] Local testing passed
- [ ] Unit tests added/updated
- [ ] Manual testing in browser

## Screenshots (if UI changes)
[Add screenshots here]

## Related Issues
Closes #123
```

**Checklist avant de créer une PR** :
- [ ] Code compile sans erreurs (`pnpm build`)
- [ ] Tests passent (`pnpm test`)
- [ ] Pas d'erreurs ESLint (`pnpm lint`)
- [ ] Pas d'erreurs TypeScript (`pnpm typecheck`)
- [ ] Commit messages sont clairs
- [ ] Documentation mise à jour si nécessaire

---

## Testing

### Structure des tests

```typescript
// __tests__/user-service.test.ts
import { getUserById } from '@/services/user-service'
import { db } from '@lineky/database'

// Mock Prisma
jest.mock('@lineky/database', () => ({
  db: {
    user: {
      findUnique: jest.fn(),
    },
  },
}))

describe('getUserById', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return user when found', async () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      fullName: 'Test User',
    }

    ;(db.user.findUnique as jest.Mock).mockResolvedValue(mockUser)

    const result = await getUserById('123')

    expect(result).toEqual(mockUser)
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: '123' },
    })
  })

  it('should return null when user not found', async () => {
    ;(db.user.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getUserById('999')

    expect(result).toBeNull()
  })
})
```

### Lancer les tests

```bash
# Tous les tests
pnpm test

# Mode watch
pnpm test:watch

# Avec coverage
pnpm test -- --coverage

# Tests spécifiques
pnpm test user-service
```

### Best practices

1. **Un test = un comportement** : Tester un seul aspect par test
2. **AAA pattern** : Arrange, Act, Assert
3. **Noms descriptifs** : `should return user when found`
4. **Mocks isolés** : Ne pas dépendre de vraies API/DB
5. **Setup/Teardown** : Utiliser `beforeEach`/`afterEach`

---

## Debugging

### Logs

```typescript
import { logger } from '@/lib/logger'

// Différents niveaux
logger.info('User logged in', { userId: '123' })
logger.warn('Rate limit approaching', { count: 95 })
logger.error('Database connection failed', { error })
logger.debug('Cache hit', { key: 'user:123' })
```

### Next.js DevTools

- **React DevTools** : Installer l'extension Chrome/Firefox
- **Network tab** : Vérifier les requêtes API
- **Console** : Logs côté client

### Prisma Studio

```bash
cd packages/database
npx prisma studio
```

Interface web pour explorer et modifier les données.

### Vercel Logs (production)

```bash
# Installation
npm i -g vercel

# Login
vercel login

# Voir les logs en temps réel
vercel logs --follow

# Logs d'un déploiement spécifique
vercel logs <deployment-url>
```

---

## Performance

### Best practices

1. **Sélection de champs** : Utiliser `select` au lieu de récupérer toute l'entité
   ```typescript
   // ✅ Bon
   const users = await db.user.findMany({
     select: { id: true, email: true, fullName: true },
   })
   
   // ❌ Mauvais (récupère tous les champs)
   const users = await db.user.findMany()
   ```

2. **Pagination** : Toujours paginer les listes
   ```typescript
   const users = await db.user.findMany({
     take: 20,
     skip: page * 20,
   })
   ```

3. **Index database** : Ajouter des index sur les colonnes fréquemment requêtées
   ```prisma
   model User {
     email String @unique
     @@index([createdAt])
   }
   ```

4. **Parallélisation** : Utiliser `Promise.all` pour les requêtes indépendantes
   ```typescript
   const [users, workspaces, stats] = await Promise.all([
     db.user.count(),
     db.workspace.count(),
     getStats(),
   ])
   ```

5. **Memoization** : Utiliser React hooks comme `useMemo` et `useCallback`

---

## Sécurité

### Checklist pour chaque feature

- [ ] Validation des inputs (Zod)
- [ ] CSRF protection sur les mutations
- [ ] Authentification vérifiée
- [ ] Permissions vérifiées
- [ ] SQL injection impossible (Prisma ORM)
- [ ] XSS impossible (React auto-escape)
- [ ] Logs d'audit pour actions sensibles
- [ ] Rate limiting (TODO)
- [ ] Secrets jamais exposés au client

### Exemples

```typescript
// ✅ Bon : Validation avec Zod
const schema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
})

// ✅ Bon : CSRF protection automatique via withAdminAuth
export const POST = withAdminAuth(handler, createClient)

// ✅ Bon : Secrets côté serveur uniquement
const apiKey = process.env.SECRET_API_KEY // Jamais NEXT_PUBLIC_

// ❌ Mauvais : Secret exposé
const apiKey = process.env.NEXT_PUBLIC_SECRET_API_KEY
```

---

## Documentation

### Où documenter

- **README.md** : Vue d'ensemble, quick start
- **docs/** : Documentation détaillée (ce fichier)
- **JSDoc** : Fonctions et classes publiques
- **Inline comments** : Logique complexe, workarounds
- **API docs** : API_DOCUMENTATION.md

### Quand documenter

- Nouvelle fonctionnalité importante
- API publique (exposée aux autres packages)
- Logique complexe ou non-évidente
- Workarounds pour des bugs externes
- Décisions d'architecture

---

## Ressources

### Documentation officielle

- [Next.js](https://nextjs.org/docs)
- [React](https://react.dev)
- [Prisma](https://www.prisma.io/docs)
- [Supabase](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/primitives/docs/overview/introduction)

### Outils utiles

- [Prisma Studio](https://www.prisma.io/studio) : DB GUI
- [Supabase Studio](https://supabase.com/dashboard) : Supabase GUI
- [Vercel Dashboard](https://vercel.com/dashboard) : Déploiements
- [React DevTools](https://react.dev/learn/react-developer-tools) : Debug React

---

## Support

Pour toute question :

1. Consulter cette documentation
2. Lire le code existant (patterns établis)
3. Chercher dans les GitHub Issues
4. Demander en équipe sur Slack/Discord
5. Créer une issue GitHub si bug ou feature request
