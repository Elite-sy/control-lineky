# DEPLOYMENT_GUIDE.md

Guide complet pour déployer le projet control-lineky sur Vercel.

---

## Prérequis

### Comptes requis

1. **GitHub Account** : Pour héberger le repository
2. **Vercel Account** : Pour le déploiement
3. **Supabase Project** : Pour l'authentification et la base de données
4. **PostgreSQL Database** : Accessible depuis Internet (peut être Supabase)

### Outils locaux

- **Node.js** : v20.x ou v24.x (recommandé : v24.x)
- **pnpm** : v8.x ou supérieur
- **Git** : Pour le versioning
- **Vercel CLI** (optionnel) : `npm i -g vercel`

---

## Variables d'environnement

### Variables requises

Toutes ces variables doivent être configurées dans Vercel (Settings > Environment Variables) :

#### Base de données
```bash
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
```

#### Supabase
```bash
# URL de votre projet Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"

# Clé anonyme (publique)
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Clé service role (privée, côté serveur uniquement)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Admin Emails
```bash
# Liste des emails admin (comma-separated)
PLATFORM_ADMIN_EMAILS="admin@lineky.com,admin2@lineky.com"

# Version publique (pour validation client)
NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS="admin@lineky.com,admin2@lineky.com"
```

### Variables optionnelles

```bash
# Email configuration (si vous utilisez nodemailer)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="noreply@lineky.com"
SMTP_PASSWORD="xxxxx"

# Resend API key (alternative à SMTP)
RESEND_API_KEY="re_xxxxx"

# Monitoring & Logging
SENTRY_DSN="https://xxxxx@sentry.io/xxxxx"
```

### Configuration dans Vercel

1. Aller sur **Vercel Dashboard** > Votre projet > **Settings** > **Environment Variables**
2. Ajouter chaque variable une par une
3. Sélectionner les environnements : **Production**, **Preview**, **Development**
4. Cliquer sur **Save**

---

## Déploiement local

### 1. Cloner le repository

```bash
git clone https://github.com/Elite-sy/control-lineky.git
cd control-lineky
```

### 2. Installer les dépendances

```bash
pnpm install
```

Cette commande va :
- Installer toutes les dépendances npm
- Exécuter le hook `postinstall` qui génère le client Prisma

### 3. Configuration locale

Créer un fichier `.env.local` à la racine :

```bash
# Copier depuis .env.example si disponible
cp .env.example .env.local

# Éditer avec vos valeurs
nano .env.local
```

Ajouter toutes les variables d'environnement listées ci-dessus.

### 4. Générer le client Prisma (si nécessaire)

```bash
cd packages/database
npx prisma generate
cd ../..
```

### 5. Lancer le serveur de développement

```bash
pnpm dev
```

Le serveur démarre sur http://localhost:3001

### 6. Tester l'application

1. Ouvrir http://localhost:3001
2. Vous devriez être redirigé vers `/auth/signin`
3. Tester la connexion avec un compte admin Supabase

---

## Déploiement Vercel

### Méthode 1 : Via l'interface Vercel (recommandée)

#### Première configuration

1. **Connecter le repository** :
   - Aller sur https://vercel.com
   - Cliquer sur **Add New** > **Project**
   - Sélectionner votre repository GitHub `Elite-sy/control-lineky`
   - Autoriser Vercel à accéder au repository

2. **Configurer le projet** :
   - **Framework Preset** : Next.js (détecté automatiquement)
   - **Root Directory** : `.` (racine)
   - **Build Command** : `pnpm run build:packages && pnpm run build`
   - **Install Command** : `pnpm install`
   - **Output Directory** : `.next` (défaut)
   - **Node Version** : 24.x

3. **Ajouter les variables d'environnement** :
   - Cliquer sur **Environment Variables**
   - Ajouter toutes les variables listées dans la section précédente
   - Sélectionner **Production**, **Preview**, **Development**

4. **Déployer** :
   - Cliquer sur **Deploy**
   - Attendre 2-3 minutes que le build se termine
   - Vérifier les logs en cas d'erreur

#### Déploiements ultérieurs

- Chaque push sur `main` déclenche automatiquement un déploiement
- Les pull requests créent des déploiements Preview

### Méthode 2 : Via Vercel CLI

#### Installation

```bash
npm i -g vercel
```

#### Login

```bash
vercel login
```

#### Premier déploiement

```bash
cd control-lineky
vercel
```

Répondre aux questions :
- **Set up and deploy** : Yes
- **Which scope** : Votre compte/team
- **Link to existing project** : No
- **Project name** : control-lineky
- **Directory** : ./ (défaut)

#### Ajouter les variables d'environnement

```bash
vercel env add DATABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add PLATFORM_ADMIN_EMAILS production
vercel env add NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS production
```

Répéter pour `preview` et `development` si nécessaire.

#### Déployer en production

```bash
vercel --prod
```

### Méthode 3 : Via Git push (automatique)

Une fois le projet configuré sur Vercel :

```bash
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin main
```

Vercel détecte automatiquement le push et lance un déploiement.

---

## Configuration Supabase

### 1. Créer le projet Supabase

1. Aller sur https://supabase.com
2. Créer un nouveau projet
3. Noter l'URL et les clés API

### 2. Configurer l'authentification

1. **Authentication** > **Providers**
2. Activer **Email** provider
3. Configurer les **Email Templates** si nécessaire

### 3. Configurer les URLs de redirection

1. **Authentication** > **URL Configuration**
2. Ajouter les **Redirect URLs** :
   ```
   http://localhost:3001/auth/callback
   https://votre-domaine.vercel.app/auth/callback
   https://control.lineky.com/auth/callback
   ```

### 4. Créer les utilisateurs admin

1. **Authentication** > **Users**
2. Cliquer sur **Add user** > **Create new user**
3. Email : `admin@lineky.com` (doit correspondre à `PLATFORM_ADMIN_EMAILS`)
4. Password : Choisir un mot de passe sécurisé
5. Confirmer l'email (ou désactiver la confirmation en dev)

### 5. Configurer la base de données

Si vous utilisez la base Supabase :
- Copier la **Connection String** depuis **Settings** > **Database**
- Ajouter `?pgbouncer=true` à la fin pour utiliser le connection pooling
- Utiliser comme `DATABASE_URL`

---

## Configuration du domaine custom

### 1. Ajouter le domaine dans Vercel

1. **Vercel Dashboard** > Votre projet > **Settings** > **Domains**
2. Cliquer sur **Add**
3. Entrer `control.lineky.com`
4. Vercel vous donne les enregistrements DNS à configurer

### 2. Configurer le DNS

Chez votre registraire de domaine (ex: Cloudflare, Namecheap) :

#### Option A : CNAME (recommandé)
```
Type: CNAME
Name: control
Value: cname.vercel-dns.com
```

#### Option B : A Record
```
Type: A
Name: control
Value: 76.76.21.21
```

### 3. Vérifier le domaine

- Attendre la propagation DNS (5-60 minutes)
- Vercel vérifie automatiquement et génère un certificat SSL

### 4. Mettre à jour Supabase

Ajouter la nouvelle URL dans les **Redirect URLs** :
```
https://control.lineky.com/auth/callback
```

---

## Vérifications post-déploiement

### 1. Health Check

Vérifier que l'application répond :
```bash
curl https://votre-domaine.vercel.app/api/health
```

### 2. Authentification

1. Aller sur https://votre-domaine.vercel.app
2. Vous devriez être redirigé vers `/auth/signin`
3. Tester la connexion avec un compte admin

### 3. CSRF Token

Vérifier que le token est généré :
```bash
curl https://votre-domaine.vercel.app/api/admin/csrf-token
```

Réponse attendue :
```json
{
  "token": "xxx...",
  "message": "CSRF token generated successfully"
}
```

### 4. Routes Admin

Tester une route protégée (nécessite authentification) :
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://votre-domaine.vercel.app/api/admin/overview
```

### 5. Logs Vercel

1. **Vercel Dashboard** > Votre projet > **Deployments**
2. Cliquer sur le dernier déploiement
3. Vérifier les **Build Logs**
4. Vérifier les **Function Logs** pour les erreurs runtime

### 6. Database Connection

Vérifier que Prisma peut se connecter :
- Les logs doivent montrer des requêtes SQL réussies
- Pas d'erreurs "Connection refused" ou "Timeout"

---

## Rollback procedure

### En cas de problème sur un déploiement

#### Option 1 : Via l'interface Vercel

1. **Vercel Dashboard** > Votre projet > **Deployments**
2. Trouver le dernier déploiement stable
3. Cliquer sur les **3 points** > **Promote to Production**
4. Confirmer

#### Option 2 : Via Git

```bash
# Revenir au dernier commit stable
git log --oneline
git revert HEAD
git push origin main
```

#### Option 3 : Via Vercel CLI

```bash
# Lister les déploiements
vercel ls

# Promouvoir un déploiement spécifique
vercel promote <deployment-url>
```

---

## Troubleshooting

### Build Failures

#### Error: "Prisma client not generated"

**Solution** :
```bash
# Vérifier que le postinstall s'exécute
pnpm install

# Forcer la génération
cd packages/database
npx prisma generate
```

#### Error: "Cannot find module @lineky/database"

**Solution** :
Vérifier que `pnpm-workspace.yaml` existe et contient :
```yaml
packages:
  - 'packages/*'
```

#### Error: "Next.js version vulnerable"

**Solution** :
```bash
# Mettre à jour Next.js
pnpm add next@latest eslint-config-next@latest

# Vérifier la version
pnpm list next
```

### Runtime Errors

#### Error: "CSRF token not available"

**Causes possibles** :
1. Pas d'authentification Supabase
2. Cookies bloqués par le navigateur
3. Domaine non configuré dans Supabase redirects

**Solutions** :
1. Vérifier que l'utilisateur est dans `PLATFORM_ADMIN_EMAILS`
2. Vérifier les cookies dans DevTools
3. Ajouter le domaine dans Supabase URL Configuration

#### Error: "Supabase client factory not provided"

**Solution** :
Vérifier que toutes les routes admin passent `createClient` :
```typescript
import { createClient } from '@lineky/supabase/server'

export const GET = withAdminAuth(
  async (_req) => { /* ... */ },
  createClient  // ← Ne pas oublier
)
```

#### Error: "Database connection failed"

**Causes possibles** :
1. `DATABASE_URL` incorrect
2. Base de données inaccessible depuis Vercel
3. Firewall bloquant les connexions

**Solutions** :
1. Vérifier la connection string dans Vercel env vars
2. Whitelist les IPs Vercel dans votre firewall
3. Utiliser connection pooling (PgBouncer)

### Performance Issues

#### Slow API responses

**Solutions** :
1. Ajouter des index sur les colonnes fréquemment requêtées
2. Utiliser `findMany` avec `select` au lieu de `findMany` complet
3. Implémenter du caching avec Redis ou Vercel KV

#### High memory usage

**Solutions** :
1. Limiter la taille des résultats avec `take` et `skip`
2. Utiliser pagination sur les listes
3. Augmenter la taille de la fonction Vercel si nécessaire

---

## Monitoring

### Logs Vercel

Les logs sont disponibles dans :
- **Real-time** : Via Vercel CLI `vercel logs`
- **Historical** : Via Vercel Dashboard > Deployments > Function Logs

### Erreurs courantes à surveiller

```bash
# Filtrer les erreurs
vercel logs --follow | grep "Error"

# Filtrer les 500
vercel logs --follow | grep "500"
```

### Métriques importantes

- **Build time** : Devrait être < 3 minutes
- **Cold start** : < 1 seconde
- **API response time** : < 500ms
- **Error rate** : < 1%

---

## Sécurité

### Checklist de sécurité

- [ ] Toutes les variables d'environnement sont configurées
- [ ] `SUPABASE_SERVICE_ROLE_KEY` n'est jamais exposée au client
- [ ] HTTPS est forcé (automatique sur Vercel)
- [ ] CSRF protection est active sur toutes les mutations
- [ ] Les cookies utilisent le préfixe `__Host-`
- [ ] Audit logging est configuré
- [ ] Rate limiting est implémenté (TODO)
- [ ] 2FA est disponible pour les admins
- [ ] IP whitelisting est configurée pour les super admins

### Bonnes pratiques

1. **Rotation des secrets** : Changer régulièrement les clés API
2. **Principe du moindre privilège** : Utiliser des clés avec permissions minimales
3. **Monitoring des logs d'audit** : Surveiller les actions admin suspectes
4. **Backups réguliers** : Backup quotidien de la base de données
5. **Tests de sécurité** : Audits réguliers avec des outils comme OWASP ZAP

---

## Maintenance

### Mises à jour régulières

```bash
# Mettre à jour les dépendances
pnpm update

# Vérifier les vulnérabilités
pnpm audit

# Corriger les vulnérabilités
pnpm audit --fix
```

### Migrations de base de données

```bash
# Créer une migration
cd packages/database
npx prisma migrate dev --name description_de_la_migration

# Déployer en production
npx prisma migrate deploy
```

### Backup et restore

```bash
# Backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20261019.sql
```

---

## Support

En cas de problème :

1. **Documentation** : Consulter les autres docs dans `/docs`
2. **Logs Vercel** : Vérifier les logs de build et runtime
3. **GitHub Issues** : Créer une issue sur le repository
4. **Vercel Support** : https://vercel.com/support
5. **Supabase Support** : https://supabase.com/support
