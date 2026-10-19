# Control Lineky - Admin Control Panel

Platform administration interface for Lineky CRM.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com)

## 🎯 Overview

Control Lineky is a standalone Next.js application that provides a comprehensive admin control panel for managing the Lineky CRM platform. It enables platform administrators to manage users, workspaces, subscriptions, security settings, and system configuration.

**Live URL**: https://control-lineky-teal.vercel.app

## ✨ Features

- **Dashboard**: Real-time platform statistics and metrics
- **User Management**: View and manage all platform users
- **Workspace Management**: Monitor and control customer workspaces
- **Admin Management**: Manage platform administrators with role-based permissions
- **Analytics**: Comprehensive analytics with PDF export
- **Billing**: Subscription and revenue management
- **Security**: 2FA TOTP, IP whitelisting, CSRF protection
- **Audit Logs**: Complete audit trail of admin actions
- **System Config**: Platform-wide configuration management
- **Announcements**: Create and publish platform announcements
- **Feature Flags**: Dynamic feature rollout control

## 🛠 Tech Stack

- **Framework**: Next.js 15.5.9 (App Router)
- **Language**: TypeScript 5
- **UI**: React 19 + Radix UI + Tailwind CSS v4
- **Database**: PostgreSQL via Prisma ORM
- **Authentication**: Supabase Auth
- **Deployment**: Vercel
- **Package Manager**: pnpm (workspace monorepo)

## 📦 Workspace Packages

This repository includes three internal packages:

- **@lineky/database** - Prisma database client and models
- **@lineky/platform-auth** - Authentication middleware and guards
- **@lineky/supabase** - Supabase client configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x or 24.x
- pnpm 8.x+
- PostgreSQL database
- Supabase project

### Installation

```bash
# Clone the repository
git clone https://github.com/Elite-sy/control-lineky.git
cd control-lineky

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Run development server
pnpm dev
```

The application will be available at http://localhost:3001

### Environment Variables

Required variables in `.env.local`:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Admin emails (comma-separated)
PLATFORM_ADMIN_EMAILS="admin@lineky.com"
NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS="admin@lineky.com"
```

## 📚 Documentation

Comprehensive documentation is available in the `/docs` folder:

- **[PROJECT_HISTORY.md](docs/PROJECT_HISTORY.md)** - Complete project timeline and development history
- **[TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md)** - System architecture and technical design
- **[BUGS_AND_FIXES.md](docs/BUGS_AND_FIXES.md)** - All bugs encountered and their solutions
- **[DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)** - Complete deployment guide for Vercel
- **[DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md)** - Developer workflow and conventions
- **[API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)** - Complete API endpoint documentation

## 🏗 Project Structure

```
control-lineky/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/admin/    # Admin API endpoints (16 routes)
│   │   └── auth/         # Authentication pages
│   ├── components/       # React components
│   │   ├── admin/        # Admin-specific components
│   │   └── ui/           # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and helpers
│   └── services/         # Business logic
├── packages/
│   ├── database/         # Prisma schema and client
│   ├── platform-auth/    # Authentication middleware
│   └── supabase/         # Supabase clients
├── docs/                 # Documentation
└── public/               # Static assets
```

## 🔐 Authentication

The application uses Supabase Auth with email/password authentication. Admin access is controlled by:

1. Valid Supabase session
2. Email listed in `PLATFORM_ADMIN_EMAILS`
3. Optional: PlatformAdmin database record for role-based permissions
4. Optional: 2FA TOTP for enhanced security
5. Optional: IP whitelisting for specific admins

## 🔒 Security Features

- ✅ CSRF protection on all mutating requests
- ✅ Role-based access control (super_admin, billing_admin, support_admin)
- ✅ 2FA TOTP support
- ✅ IP whitelisting
- ✅ Audit logging of all admin actions
- ✅ Secure cookies with `__Host-` prefix
- ✅ SQL injection protection (Prisma ORM)
- ✅ XSS protection (React auto-escape)

## 📊 Available Scripts

```bash
# Development
pnpm dev              # Start dev server on port 3001
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm typecheck        # Run TypeScript type checking

# Testing
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode

# Database (from packages/database)
cd packages/database
npx prisma migrate dev     # Create and apply migration
npx prisma generate        # Generate Prisma client
npx prisma studio          # Open Prisma Studio GUI
```

## 🚢 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

See [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for detailed instructions.

### Build Configuration

The build process compiles workspace packages before building Next.js:

```json
{
  "buildCommand": "pnpm run build:packages && pnpm run build"
}
```

## 📈 Development Status

**Current Status**: ✅ Production Ready

- [x] Initial setup and configuration
- [x] Authentication system with Supabase
- [x] CSRF protection
- [x] Admin dashboard with stats
- [x] User management
- [x] Workspace management
- [x] Admin management
- [x] Analytics with PDF export
- [x] Billing and subscriptions
- [x] Security (2FA, IP whitelist)
- [x] Audit logging
- [x] System configuration
- [ ] Rate limiting (TODO)
- [ ] Webhooks (TODO)

## 🐛 Known Issues

None currently. See [BUGS_AND_FIXES.md](docs/BUGS_AND_FIXES.md) for historical issues and solutions.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) for detailed guidelines.

## 📝 Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): add new feature
fix(scope): fix bug
docs(scope): update documentation
style(scope): format code
refactor(scope): refactor code
test(scope): add tests
chore(scope): update dependencies
```

## 📄 License

Proprietary - Lineky Platform

## 🔗 Links

- **Repository**: https://github.com/Elite-sy/control-lineky
- **Live App**: https://control-lineky-teal.vercel.app
- **Main CRM**: https://lineky.com
- **Documentation**: [/docs](docs/)

## 🆘 Support

For issues or questions:

1. Check the [documentation](docs/)
2. Review [BUGS_AND_FIXES.md](docs/BUGS_AND_FIXES.md)
3. Create a GitHub issue
4. Contact the development team

## 📊 Stats

- **Lines of Code**: ~5,000+
- **Components**: 30+
- **API Endpoints**: 16
- **Commits**: 18
- **Development Time**: 1 day
- **Build Time**: ~2-3 minutes
- **Dependencies**: 60+

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org)
- [React](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Radix UI](https://www.radix-ui.com)
- [Prisma](https://www.prisma.io)
- [Supabase](https://supabase.com)
- [Vercel](https://vercel.com)

---

**Made with ❤️ by the Lineky Team**
