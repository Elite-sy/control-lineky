# API_DOCUMENTATION.md

Documentation complète de tous les endpoints API du control panel Lineky.

---

## Authentification

Tous les endpoints admin (sauf `/api/admin/csrf-token`) nécessitent :
1. **Session Supabase valide** : Cookie de session
2. **Email admin** : Dans `PLATFORM_ADMIN_EMAILS`
3. **Token CSRF** : Header `x-csrf-token` pour mutations (POST, PATCH, DELETE)

---

## Headers requis

### Lecture (GET)
```
Cookie: sb-access-token=xxx; sb-refresh-token=xxx
```

### Mutation (POST, PATCH, DELETE)
```
Cookie: sb-access-token=xxx; sb-refresh-token=xxx
Content-Type: application/json
x-csrf-token: <token-from-csrf-endpoint>
```

---

## Endpoints

### POST /api/admin/csrf-token

Génère un token CSRF pour les requêtes authentifiées.

**Auth requise** : Non (le token est utilisé ensuite pour authentifier)

**Request** :
```http
GET /api/admin/csrf-token HTTP/1.1
```

**Response 200** :
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "CSRF token generated successfully"
}
```

**Cookies** :
```
__Host-csrf-token=<token>; Path=/; HttpOnly; Secure; SameSite=Strict
```

**Errors** : Aucune (toujours génère un token)

---

## Dashboard

### GET /api/admin/overview

Statistiques globales de la plateforme.

**Auth** : Admin  
**Permission** : `view_analytics`

**Request** :
```http
GET /api/admin/overview HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** :
```json
{
  "stats": {
    "totalWorkspaces": 145,
    "totalUsers": 523,
    "totalContacts": 8234,
    "totalDeals": 1245,
    "totalCompanies": 456,
    "totalTasks": 3421,
    "totalTickets": 789
  },
  "planDistribution": [
    { "plan": "free", "_count": { "id": 89 } },
    { "plan": "starter", "_count": { "id": 34 } },
    { "plan": "pro", "_count": { "id": 18 } },
    { "plan": "enterprise", "_count": { "id": 4 } }
  ],
  "subscriptions": [
    {
      "id": "sub_123",
      "status": "active",
      "currentPeriodStart": "2026-10-01T00:00:00Z",
      "currentPeriodEnd": "2026-11-01T00:00:00Z",
      "workspace": {
        "name": "Acme Corp",
        "slug": "acme-corp"
      },
      "plan": {
        "displayName": "Pro",
        "price": 49.99
      }
    }
  ],
  "mrr": 7849.86,
  "arr": 94198.32
}
```

**Errors** :
- `401` : Not authenticated
- `403` : Not a platform admin

---

## User Management

### GET /api/admin/users

Liste tous les utilisateurs de la plateforme avec leurs workspaces et rôles.

**Auth** : Admin  
**Permission** : `view_users`

**Query Parameters** :
- `page` (optional) : Page number (default: 1)
- `limit` (optional) : Items per page (default: 50, max: 100)
- `search` (optional) : Search by email or name
- `status` (optional) : `active` | `inactive`

**Request** :
```http
GET /api/admin/users?page=1&limit=50&search=john&status=active HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** :
```json
{
  "users": [
    {
      "id": "clx123",
      "authUserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "john@example.com",
      "fullName": "John Doe",
      "avatarUrl": "https://example.com/avatar.jpg",
      "isActive": true,
      "createdAt": "2026-01-15T10:30:00Z",
      "lastLoginAt": "2026-10-19T14:22:00Z",
      "memberships": [
        {
          "role": "owner",
          "joinedAt": "2026-01-15T10:30:00Z",
          "workspace": {
            "id": "wks_456",
            "name": "Acme Corp",
            "slug": "acme-corp",
            "plan": "pro"
          }
        }
      ]
    }
  ],
  "pagination": {
    "total": 523,
    "page": 1,
    "limit": 50,
    "totalPages": 11
  }
}
```

**Errors** :
- `401` : Not authenticated
- `403` : Not a platform admin or insufficient permissions

---

### PATCH /api/admin/users

Actions sur un utilisateur.

**Auth** : Admin  
**Permission** : `manage_users`  
**CSRF** : Required

**Actions disponibles** :
- `toggle-active` : Activer/désactiver un compte
- `invite` : Envoyer une invitation admin

#### Action: toggle-active

**Request** :
```http
PATCH /api/admin/users HTTP/1.1
Cookie: sb-access-token=xxx
x-csrf-token: <token>
Content-Type: application/json

{
  "action": "toggle-active",
  "userId": "clx123"
}
```

**Response 200** :
```json
{
  "success": true,
  "user": {
    "id": "clx123",
    "email": "john@example.com",
    "isActive": false
  },
  "message": "User deactivated successfully"
}
```

#### Action: invite

**Request** :
```json
{
  "action": "invite",
  "email": "newuser@example.com"
}
```

**Response 200** :
```json
{
  "success": true,
  "message": "Invitation sent to newuser@example.com"
}
```

**Errors** :
- `400` : Invalid action or missing parameters
- `401` : Not authenticated
- `403` : Invalid CSRF token or insufficient permissions
- `404` : User not found
- `500` : Internal error

---

## Workspace Management

### GET /api/admin/workspaces

Liste tous les workspaces avec leurs plans et statistiques.

**Auth** : Admin  
**Permission** : `view_workspaces`

**Query Parameters** :
- `page` (optional) : Page number
- `limit` (optional) : Items per page
- `plan` (optional) : Filter by plan (free, starter, pro, enterprise)
- `search` (optional) : Search by name or slug

**Request** :
```http
GET /api/admin/workspaces?plan=pro&page=1&limit=50 HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** :
```json
{
  "workspaces": [
    {
      "id": "wks_123",
      "slug": "acme-corp",
      "name": "Acme Corp",
      "plan": "pro",
      "isActive": true,
      "createdAt": "2026-01-15T10:30:00Z",
      "memberships": [
        {
          "_count": { "id": 12 }
        }
      ],
      "subscription": {
        "status": "active",
        "currentPeriodEnd": "2026-11-15T10:30:00Z"
      },
      "_count": {
        "contacts": 234,
        "deals": 45,
        "tasks": 167
      }
    }
  ],
  "pagination": {
    "total": 145,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

---

### PATCH /api/admin/workspaces

Actions sur un workspace.

**Auth** : Admin  
**Permission** : `manage_workspaces`  
**CSRF** : Required

**Actions** :
- `suspend` : Suspendre un workspace
- `resume` : Réactiver un workspace suspendu
- `upgrade` : Changer de plan
- `delete` : Supprimer un workspace (⚠️ irréversible)

#### Action: suspend

**Request** :
```json
{
  "action": "suspend",
  "workspaceId": "wks_123",
  "reason": "Non-payment"
}
```

**Response 200** :
```json
{
  "success": true,
  "workspace": {
    "id": "wks_123",
    "isActive": false
  },
  "message": "Workspace suspended"
}
```

#### Action: upgrade

**Request** :
```json
{
  "action": "upgrade",
  "workspaceId": "wks_123",
  "plan": "enterprise"
}
```

**Response 200** :
```json
{
  "success": true,
  "workspace": {
    "id": "wks_123",
    "plan": "enterprise"
  },
  "message": "Workspace upgraded to enterprise"
}
```

---

## Admin Management

### GET /api/admin/admins

Liste tous les administrateurs plateforme.

**Auth** : Super admin  
**Permission** : `manage_admins`

**Request** :
```http
GET /api/admin/admins HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** :
```json
{
  "admins": [
    {
      "id": "adm_123",
      "email": "admin@lineky.com",
      "role": "super_admin",
      "isActive": true,
      "twoFactorEnabled": true,
      "allowedIps": "192.168.1.1,10.0.0.1",
      "createdAt": "2026-01-01T00:00:00Z",
      "lastLoginAt": "2026-10-19T14:00:00Z"
    }
  ]
}
```

---

### POST /api/admin/admins

Créer un nouvel administrateur plateforme.

**Auth** : Super admin  
**Permission** : `manage_admins`  
**CSRF** : Required

**Request** :
```json
{
  "email": "newadmin@lineky.com",
  "role": "billing_admin"
}
```

**Roles disponibles** :
- `super_admin` : Toutes les permissions
- `billing_admin` : Gestion billing et abonnements
- `support_admin` : Gestion support et tickets

**Response 200** :
```json
{
  "success": true,
  "admin": {
    "id": "adm_456",
    "email": "newadmin@lineky.com",
    "role": "billing_admin",
    "isActive": true
  },
  "message": "Admin created successfully"
}
```

**Errors** :
- `400` : Email already exists or invalid role
- `403` : Not a super admin

---

### PATCH /api/admin/admins

Mettre à jour un administrateur.

**Auth** : Super admin  
**Permission** : `manage_admins`  
**CSRF** : Required

**Request** :
```json
{
  "adminId": "adm_456",
  "updates": {
    "role": "super_admin",
    "isActive": true
  }
}
```

**Response 200** :
```json
{
  "success": true,
  "admin": {
    "id": "adm_456",
    "role": "super_admin",
    "isActive": true
  }
}
```

---

## Analytics

### GET /api/admin/analytics

Données analytics de la plateforme.

**Auth** : Admin  
**Permission** : `view_analytics`

**Query Parameters** :
- `period` : `7d` | `30d` | `90d` | `1y` (default: 30d)
- `metric` (optional) : Metric spécifique à récupérer

**Request** :
```http
GET /api/admin/analytics?period=30d HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** :
```json
{
  "period": "30d",
  "metrics": {
    "newUsers": 234,
    "newWorkspaces": 45,
    "revenue": 15678.90,
    "churnRate": 2.3
  },
  "charts": {
    "userGrowth": [
      { "date": "2026-09-20", "count": 489 },
      { "date": "2026-09-21", "count": 492 },
      { "date": "2026-09-22", "count": 498 }
    ],
    "revenueGrowth": [
      { "date": "2026-09-20", "amount": 7234.50 },
      { "date": "2026-09-21", "amount": 7456.20 }
    ]
  }
}
```

---

### GET /api/admin/analytics/export-pdf

Exporte les analytics en PDF.

**Auth** : Admin  
**Permission** : `export_analytics`

**Query Parameters** :
- `period` : `7d` | `30d` | `90d` | `1y`

**Request** :
```http
GET /api/admin/analytics/export-pdf?period=30d HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** :
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="analytics-2026-10-19.pdf"

[PDF binary data]
```

---

## Billing

### GET /api/admin/billing

Informations de facturation et abonnements.

**Auth** : Admin  
**Permission** : `view_billing`

**Request** :
```http
GET /api/admin/billing HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** :
```json
{
  "overview": {
    "mrr": 7849.86,
    "arr": 94198.32,
    "activeSubscriptions": 56,
    "trialingSubscriptions": 12
  },
  "subscriptions": [
    {
      "id": "sub_123",
      "workspaceId": "wks_456",
      "workspace": {
        "name": "Acme Corp",
        "slug": "acme-corp"
      },
      "plan": {
        "id": "plan_pro",
        "displayName": "Pro",
        "price": 49.99
      },
      "status": "active",
      "currentPeriodStart": "2026-10-01T00:00:00Z",
      "currentPeriodEnd": "2026-11-01T00:00:00Z"
    }
  ],
  "recentTransactions": [
    {
      "id": "txn_789",
      "workspaceId": "wks_456",
      "amount": 49.99,
      "status": "succeeded",
      "createdAt": "2026-10-01T00:00:00Z"
    }
  ]
}
```

---

## Announcements

### GET /api/admin/announcements

Liste les annonces plateforme.

**Auth** : Admin  
**Permission** : `view_announcements`

**Query Parameters** :
- `status` (optional) : `draft` | `published` | `archived`

**Request** :
```http
GET /api/admin/announcements?status=published HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** :
```json
{
  "announcements": [
    {
      "id": "ann_123",
      "title": "New features released",
      "content": "We're excited to announce...",
      "type": "feature",
      "status": "published",
      "publishedAt": "2026-10-15T10:00:00Z",
      "createdBy": "adm_456",
      "createdAt": "2026-10-14T15:00:00Z"
    }
  ]
}
```

---

### POST /api/admin/announcements

Créer une nouvelle annonce.

**Auth** : Admin  
**Permission** : `manage_announcements`  
**CSRF** : Required

**Request** :
```json
{
  "title": "Maintenance scheduled",
  "content": "We will be performing maintenance on...",
  "type": "maintenance",
  "status": "draft",
  "publishAt": "2026-10-20T00:00:00Z"
}
```

**Types** :
- `feature` : Nouvelle fonctionnalité
- `maintenance` : Maintenance planifiée
- `incident` : Incident en cours
- `update` : Mise à jour générale

**Response 200** :
```json
{
  "success": true,
  "announcement": {
    "id": "ann_456",
    "title": "Maintenance scheduled",
    "status": "draft"
  }
}
```

---

## Audit Logs

### GET /api/admin/audit-logs

Logs d'audit des actions admin.

**Auth** : Admin  
**Permission** : `view_audit_logs`

**Query Parameters** :
- `limit` (optional) : Items per page (default: 50, max: 200)
- `offset` (optional) : Offset for pagination
- `adminId` (optional) : Filter by admin ID
- `action` (optional) : Filter by action type
- `startDate` (optional) : ISO date
- `endDate` (optional) : ISO date

**Request** :
```http
GET /api/admin/audit-logs?limit=50&offset=0&action=user.deactivate HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** :
```json
{
  "logs": [
    {
      "id": "log_123",
      "adminId": "adm_456",
      "admin": {
        "email": "admin@lineky.com"
      },
      "action": "user.deactivate",
      "targetType": "User",
      "targetId": "clx789",
      "metadata": {
        "reason": "Terms violation",
        "previousStatus": "active"
      },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-10-19T14:30:00Z"
    }
  ],
  "pagination": {
    "total": 1234,
    "limit": 50,
    "offset": 0
  }
}
```

**Action types** :
- `user.create`, `user.update`, `user.deactivate`
- `workspace.create`, `workspace.suspend`, `workspace.delete`
- `admin.create`, `admin.update`, `admin.delete`
- `subscription.create`, `subscription.cancel`
- `config.update`

---

## Feature Flags

### GET /api/admin/feature-flags

Liste les feature flags.

**Auth** : Admin  
**Permission** : `view_feature_flags`

**Request** :
```http
GET /api/admin/feature-flags HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** :
```json
{
  "flags": [
    {
      "id": "ff_123",
      "key": "new_dashboard",
      "name": "New Dashboard",
      "description": "Enable the redesigned dashboard",
      "enabled": false,
      "rolloutPercentage": 0,
      "createdAt": "2026-10-01T00:00:00Z"
    }
  ]
}
```

---

### PATCH /api/admin/feature-flags

Toggle un feature flag.

**Auth** : Admin  
**Permission** : `manage_feature_flags`  
**CSRF** : Required

**Request** :
```json
{
  "flagId": "ff_123",
  "enabled": true,
  "rolloutPercentage": 25
}
```

**Response 200** :
```json
{
  "success": true,
  "flag": {
    "id": "ff_123",
    "key": "new_dashboard",
    "enabled": true,
    "rolloutPercentage": 25
  }
}
```

---

## Security

### GET /api/admin/security/2fa

Configuration 2FA pour l'admin connecté.

**Auth** : Admin

**Request** :
```http
GET /api/admin/security/2fa HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** (2FA disabled) :
```json
{
  "enabled": false,
  "qrCodeUrl": null
}
```

**Response 200** (2FA enabled) :
```json
{
  "enabled": true,
  "qrCodeUrl": null
}
```

---

### POST /api/admin/security/2fa

Enable/disable 2FA.

**Auth** : Admin  
**CSRF** : Required

#### Enable 2FA

**Request** :
```json
{
  "action": "enable"
}
```

**Response 200** :
```json
{
  "success": true,
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCodeUrl": "data:image/png;base64,iVBORw0KGgo...",
  "message": "Scan the QR code with your authenticator app"
}
```

#### Verify and activate 2FA

**Request** :
```json
{
  "action": "verify",
  "code": "123456"
}
```

**Response 200** :
```json
{
  "success": true,
  "message": "2FA enabled successfully"
}
```

#### Disable 2FA

**Request** :
```json
{
  "action": "disable",
  "code": "123456"
}
```

**Response 200** :
```json
{
  "success": true,
  "message": "2FA disabled successfully"
}
```

**Errors** :
- `400` : Invalid code
- `403` : CSRF token invalid

---

### GET /api/admin/security/ip-whitelist

Liste des IPs whitelistées pour l'admin.

**Auth** : Admin

**Request** :
```http
GET /api/admin/security/ip-whitelist HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** :
```json
{
  "allowedIps": ["192.168.1.1", "10.0.0.1"],
  "currentIp": "192.168.1.1"
}
```

---

### PATCH /api/admin/security/ip-whitelist

Met à jour la whitelist IP.

**Auth** : Admin  
**CSRF** : Required

**Request** :
```json
{
  "allowedIps": ["192.168.1.1", "10.0.0.1", "203.0.113.0"]
}
```

**Response 200** :
```json
{
  "success": true,
  "allowedIps": ["192.168.1.1", "10.0.0.1", "203.0.113.0"],
  "message": "IP whitelist updated"
}
```

**Errors** :
- `400` : Invalid IP format
- `403` : Cannot remove current IP

---

## Support

### GET /api/admin/support-tickets

Liste les tickets de support.

**Auth** : Admin  
**Permission** : `view_support_tickets`

**Query Parameters** :
- `status` (optional) : `open` | `in_progress` | `resolved` | `closed`
- `priority` (optional) : `low` | `medium` | `high` | `urgent`

**Request** :
```http
GET /api/admin/support-tickets?status=open&priority=high HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** :
```json
{
  "tickets": [
    {
      "id": "tkt_123",
      "subject": "Cannot access workspace",
      "status": "open",
      "priority": "high",
      "userId": "clx456",
      "user": {
        "email": "user@example.com",
        "fullName": "John Doe"
      },
      "createdAt": "2026-10-19T10:00:00Z",
      "updatedAt": "2026-10-19T10:00:00Z"
    }
  ]
}
```

---

## System Config

### GET /api/admin/system-config

Configuration système.

**Auth** : Super admin  
**Permission** : `manage_system_config`

**Request** :
```http
GET /api/admin/system-config HTTP/1.1
Cookie: sb-access-token=xxx
```

**Response 200** :
```json
{
  "config": {
    "maintenanceMode": false,
    "signupsEnabled": true,
    "maxWorkspacesPerUser": 5,
    "emailSettings": {
      "provider": "resend",
      "fromName": "Lineky",
      "fromEmail": "noreply@lineky.com"
    },
    "features": {
      "newDashboard": false,
      "aiAssistant": true
    }
  }
}
```

---

### PATCH /api/admin/system-config

Met à jour la configuration système.

**Auth** : Super admin  
**Permission** : `manage_system_config`  
**CSRF** : Required

**Request** :
```json
{
  "maintenanceMode": true,
  "emailSettings": {
    "fromName": "Lineky Support"
  }
}
```

**Response 200** :
```json
{
  "success": true,
  "config": {
    "maintenanceMode": true,
    "emailSettings": {
      "fromName": "Lineky Support"
    }
  }
}
```

---

### POST /api/admin/system-config/test-email

Envoie un email de test.

**Auth** : Admin  
**Permission** : `manage_system_config`  
**CSRF** : Required

**Request** :
```json
{
  "to": "admin@lineky.com"
}
```

**Response 200** :
```json
{
  "success": true,
  "message": "Test email sent to admin@lineky.com"
}
```

**Errors** :
- `400` : Invalid email
- `500` : Email service error

---

## Error Responses

Tous les endpoints peuvent retourner ces erreurs :

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

### 403 CSRF Invalid
```json
{
  "error": "Forbidden",
  "message": "Invalid CSRF token"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

**TODO** : À implémenter

Limites prévues :
- 100 requêtes/minute par IP
- 1000 requêtes/heure par admin
- 10 tentatives de login/heure par IP

---

## Webhooks

**TODO** : À implémenter

Événements prévus :
- `user.created`
- `workspace.created`
- `subscription.activated`
- `subscription.canceled`
