# @lineky/database

Shared database package for the Lineky monorepo. Contains the Prisma schema, migrations, and database client singleton.

## Installation

This package is automatically available in the workspace. Add it to your app's dependencies:

```json
{
  "dependencies": {
    "@lineky/database": "workspace:*"
  }
}
```

## Usage

### Import the database client

```typescript
import { db } from '@lineky/database';

// Query the database
const users = await db.user.findMany();
```

### Import Prisma Client type

```typescript
import { PrismaClient } from '@lineky/database';
import type { User, Workspace } from '@lineky/database';
```

## Scripts

- `pnpm build` - Compile TypeScript to dist/
- `pnpm db:generate` - Generate Prisma Client
- `pnpm db:push` - Push schema changes to database (use with caution)
- `pnpm db:migrate` - Create a new migration
- `pnpm db:migrate:deploy` - Apply migrations to production
- `pnpm typecheck` - Type check without building

## Architecture

### Prisma Client Singleton

The package exports a singleton Prisma Client instance configured for PgBouncer connection pooling (Supabase). This ensures:

- Single database connection pool shared across the application
- Compatibility with Supabase's connection pooler
- Proper cleanup in development mode

### Database Connection

The client uses the `DATABASE_URL` environment variable. Ensure this is set in your app's `.env.local`:

```bash
DATABASE_URL=postgresql://...
```

## Migrations

All historical migrations are preserved in `prisma/migrations/`. To create a new migration:

```bash
cd packages/database
pnpm db:migrate
```

**⚠️ WARNING:** The `DATABASE_URL` points to the production Supabase database. Never run `prisma db push` or destructive operations without explicit approval.

## Exports

- `db` - Singleton Prisma Client instance
- `PrismaClient` - Prisma Client class
- All Prisma types (User, Workspace, etc.)
