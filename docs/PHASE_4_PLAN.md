# Phase 4 Plan - Admin Features Implementation

**Phase** : 4  
**Nom** : Admin Features & Dashboard  
**Date de début prévue** : 20 octobre 2026  
**Durée estimée** : 2-3 semaines  
**Priorité** : Haute

## Objectifs de Phase 4

Transformer le control panel d'une simple authentification en un véritable panneau d'administration fonctionnel avec :
- Dashboard avec métriques temps réel
- Gestion complète des utilisateurs
- Gestion des workspaces
- Système de permissions granulaires

---

## Feature Set

### Feature 4.1 : Dashboard avec métriques réelles

**Priorité** : P0 (Critique)

**Description** :
Créer un dashboard admin avec métriques temps réel et KPIs business.

**Fonctionnalités** :
- Vue d'ensemble avec 4-6 cartes de métriques clés
- Graphiques temps réel (users actifs, revenus, conversions)
- Tableau des dernières activités
- Filtres par période (aujourd'hui, 7j, 30j, 90j, année)

**Routes API à créer** :
- `GET /api/admin/dashboard/metrics` - Métriques globales
- `GET /api/admin/dashboard/chart-data` - Données pour graphiques
- `GET /api/admin/dashboard/recent-activity` - Activités récentes

**UI Components** :
- `DashboardLayout.tsx` - Layout principal
- `MetricCard.tsx` - Carte de métrique
- `ChartWidget.tsx` - Widget graphique (Chart.js ou Recharts)
- `ActivityFeed.tsx` - Feed d'activités

**Dépendances** :
- recharts ou chart.js pour graphiques
- date-fns pour manipulation dates

**Estimation** : 3-4 jours

---

### Feature 4.2 : Gestion des utilisateurs (CRUD)

**Priorité** : P0 (Critique)

**Description** :
Interface complète de gestion des utilisateurs de la plateforme.

**Fonctionnalités** :
- Liste paginée des utilisateurs avec recherche/filtres
- Détail utilisateur avec toutes les infos
- Création/édition/suppression utilisateurs
- Gestion des rôles et permissions
- Désactivation/réactivation de comptes
- Export CSV de la liste utilisateurs

**Routes API** :
- `GET /api/admin/users` - Liste paginée (existe déjà, à améliorer)
- `GET /api/admin/users/[id]` - Détail utilisateur
- `POST /api/admin/users` - Créer utilisateur
- `PUT /api/admin/users/[id]` - Mettre à jour
- `DELETE /api/admin/users/[id]` - Supprimer
- `POST /api/admin/users/[id]/deactivate` - Désactiver
- `GET /api/admin/users/export` - Export CSV

**UI Components** :
- `UsersTable.tsx` - Tableau avec pagination
- `UserDetail.tsx` - Page détail
- `UserForm.tsx` - Formulaire création/édition
- `UserFilters.tsx` - Filtres avancés

**Dépendances** :
- react-hook-form pour formulaires
- zod pour validation
- react-table ou @tanstack/table pour tableau

**Estimation** : 5-6 jours

---

### Feature 4.3 : Gestion des workspaces

**Priorité** : P1 (Important)

**Description** :
Interface de gestion des workspaces (organisations/entreprises utilisant la plateforme).

**Fonctionnalités** :
- Liste des workspaces avec recherche
- Création/édition/suppression workspaces
- Configuration des quotas par workspace
- Gestion des membres du workspace
- Vue détaillée avec analytics

**Routes API** :
- `GET /api/admin/workspaces` - Liste paginée (existe déjà, à améliorer)
- `GET /api/admin/workspaces/[id]` - Détail
- `POST /api/admin/workspaces` - Créer
- `PUT /api/admin/workspaces/[id]` - Mettre à jour
- `DELETE /api/admin/workspaces/[id]` - Supprimer
- `GET /api/admin/workspaces/[id]/members` - Membres
- `PUT /api/admin/workspaces/[id]/quotas` - Gérer quotas

**UI Components** :
- `WorkspacesTable.tsx`
- `WorkspaceDetail.tsx`
- `WorkspaceForm.tsx`
- `WorkspaceQuotasManager.tsx`
- `WorkspaceMembersTable.tsx`

**Estimation** : 4-5 jours

---

### Feature 4.4 : Système de permissions granulaires

**Priorité** : P1 (Important)

**Description** :
Système de permissions permettant de définir précisément ce que chaque admin peut faire.

**Fonctionnalités** :
- Définition de rôles admin (Super Admin, Admin, Support, ReadOnly)
- Permissions par module (users, workspaces, billing, config, etc.)
- UI de gestion des rôles
- Middleware de vérification des permissions

**Schéma de permissions** :
```typescript
{
  users: { read: true, write: true, delete: false },
  workspaces: { read: true, write: true, delete: false },
  billing: { read: true, write: false },
  system_config: { read: false, write: false },
  support_tickets: { read: true, write: true }
}
```

**Routes API** :
- `GET /api/admin/roles` - Liste des rôles
- `POST /api/admin/roles` - Créer rôle
- `PUT /api/admin/roles/[id]` - Mettre à jour
- `GET /api/admin/permissions` - Liste des permissions disponibles

**Modifications backend** :
- Mettre à jour `withAdminAuth` pour vérifier permissions
- Ajouter table `admin_roles` et `admin_permissions` en DB

**Estimation** : 3-4 jours

---

### Feature 4.5 : Système de recherche globale

**Priorité** : P2 (Nice to have)

**Description** :
Barre de recherche globale permettant de trouver rapidement users, workspaces, tickets, etc.

**Fonctionnalités** :
- Command palette (Cmd+K / Ctrl+K)
- Recherche full-text
- Filtres par type d'entité
- Raccourcis clavier

**Routes API** :
- `GET /api/admin/search?q=...&type=...` - Recherche globale

**UI Components** :
- `CommandPalette.tsx` (avec cmdk library)

**Dépendances** :
- cmdk pour command palette

**Estimation** : 2-3 jours

---

## Architecture technique

### Stack ajouté

- **Tables** (ou @tanstack/table) - Pour tableaux performants
- **React Hook Form** - Gestion formulaires
- **Zod** - Validation schémas
- **Recharts** ou **Chart.js** - Graphiques
- **cmdk** - Command palette
- **date-fns** - Manipulation dates

### Schéma DB à ajouter

```prisma
model AdminRole {
  id          String   @id @default(cuid())
  name        String   @unique
  permissions Json     // Permissions object
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  admins      User[]
}

// Ajouter à User model :
// roleId      String?
// role        AdminRole? @relation(fields: [roleId], references: [id])
```

### Routes à protéger

Toutes les nouvelles routes `/api/admin/*` doivent utiliser `withAdminAuth` avec vérification de permissions.

---

## Milestones & Timeline

### Milestone 4.1 : Core Dashboard (Semaine 1)
- Feature 4.1 : Dashboard avec métriques ✅

### Milestone 4.2 : User Management (Semaine 2)
- Feature 4.2 : CRUD utilisateurs ✅
- Feature 4.4 : Système permissions ✅

### Milestone 4.3 : Workspace Management (Semaine 3)
- Feature 4.3 : CRUD workspaces ✅
- Feature 4.5 : Recherche globale ✅

---

## Critères de succès

### Fonctionnels
- ✅ Dashboard affiche métriques réelles depuis la DB
- ✅ Admin peut créer/éditer/supprimer utilisateurs
- ✅ Admin peut gérer workspaces et quotas
- ✅ Système de permissions fonctionne correctement
- ✅ Recherche globale retourne résultats pertinents

### Techniques
- ✅ Tous les tests passent
- ✅ TypeScript sans erreurs
- ✅ Performance : Dashboard charge en < 2s
- ✅ Responsive sur mobile/tablette/desktop

### Documentation
- ✅ API documentation mise à jour
- ✅ Guide utilisateur pour admins
- ✅ README mis à jour avec nouvelles features

---

## Risques et mitigation

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Schéma DB incomplet | Haut | Moyen | Analyser schéma existant avant de commencer |
| Performance graphiques | Moyen | Faible | Utiliser pagination et caching |
| Permissions complexes | Haut | Moyen | Commencer simple, itérer |
| Scope creep | Moyen | Haut | Garder focus sur P0/P1 uniquement |

---

## Next Steps

1. Valider ce plan avec l'équipe
2. Préparer schéma DB pour nouvelles tables
3. Créer une nouvelle mission dans Factory
4. Commencer par Feature 4.1 (Dashboard)

---

**Prêt à démarrer** : ✅  
**Dépendances** : Aucune  
**Bloqueurs** : Aucun
