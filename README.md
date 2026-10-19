# Control Lineky - Admin Control Panel

Platform administration interface for Lineky.

## Stack

- **Framework**: Next.js 15.1.0
- **Language**: TypeScript
- **UI**: React 19 + Radix UI + Tailwind CSS
- **Package Manager**: pnpm
- **Deployment**: Vercel

## Local Packages

This repository includes three internal packages:

- `@lineky/database` - Database utilities and Prisma client
- `@lineky/platform-auth` - Authentication utilities
- `@lineky/supabase` - Supabase client configuration

## Setup

```bash
# Install dependencies
pnpm install

# Run development server
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start
```

The development server runs on [http://localhost:3001](http://localhost:3001).

## Project Structure

```
control-lineky/
├── app/              # Next.js 15 app directory
├── components/       # React components
├── lib/             # Utility functions
├── packages/        # Local workspace packages
│   ├── database/
│   ├── platform-auth/
│   └── supabase/
└── public/          # Static assets
```

## Environment Variables

Create a `.env.local` file with the required environment variables. See `.env.example` if available.

## Deploy

This project is configured for Vercel deployment. The `vercel.json` configuration handles the build and install commands for the workspace structure.

## Migration

This application was migrated from the CRM-FACTORY monorepo (`apps/control/`) to run as a standalone repository with local package dependencies.
