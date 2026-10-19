/**
 * platform-permissions.ts — Platform Admin Permission Matrix
 * 
 * Authoritative RBAC module for platform-admin operations.
 * Defines permissions for super_admin, admin, and readonly roles.
 * 
 * DO NOT reuse src/lib/rbac.ts for platform admin checks:
 * rbac.ts operates on workspace roles (admin/manager/member/user)
 * and would silently deny all platform admins.
 * 
 * Roles (matching PlatformAdmin.role in prisma/schema.prisma):
 *   - super_admin: full control over all platform operations
 *   - admin: read + limited write (users, workspaces, billing, feature-flags, announcements)
 *   - readonly: read-only access to all domains
 */

// ─── Permission Vocabulary ─────────────────────────────────────────────

/**
 * All platform admin permissions covering every admin domain.
 * Format: `domain:action` where action is `read` or `write`.
 */
export const PLATFORM_PERMISSIONS = [
  // Admin management
  'admins:read',
  'admins:write',
  
  // Audit logs
  'audit:read',
  'audit:write',
  
  // User management
  'users:read',
  'users:write',
  
  // Workspace management
  'workspaces:read',
  'workspaces:write',
  
  // Billing
  'billing:read',
  'billing:write',
  
  // Security configuration
  'security:read',
  'security:write',
  
  // Feature flags
  'feature-flags:read',
  'feature-flags:write',
  
  // System configuration
  'system-config:read',
  'system-config:write',
  
  // Announcements
  'announcements:read',
  'announcements:write',
  
  // Analytics
  'analytics:read',
  'analytics:write',
  
  // Support
  'support:read',
  'support:write',
] as const;

export type PlatformPermission = typeof PLATFORM_PERMISSIONS[number];

/**
 * Platform admin roles (matching PlatformAdmin.role in Prisma schema).
 */
export type PlatformRole = 'super_admin' | 'admin' | 'readonly';

// ─── Permission Matrix ─────────────────────────────────────────────────

/**
 * Machine-readable permission matrix: role → permissions[]
 * Used for documentation parity testing.
 */
export const PERMISSION_MATRIX: Record<PlatformRole, readonly PlatformPermission[]> = {
  super_admin: PLATFORM_PERMISSIONS,
  
  admin: [
    // Read access to all domains
    'admins:read',
    'audit:read',
    'users:read',
    'workspaces:read',
    'billing:read',
    'security:read',
    'feature-flags:read',
    'system-config:read',
    'announcements:read',
    'analytics:read',
    'support:read',
    
    // Write access to non-critical domains only
    'users:write',
    'workspaces:write',
    'billing:write',
    'feature-flags:write',
    'announcements:write',
    // Explicitly NOT granted: admins:write, security:write, system-config:write
  ],
  
  readonly: [
    // Read-only access to most domains
    // NOTE: admins:read and audit:read excluded - sensitive admin operations require admin+ role
    'users:read',
    'workspaces:read',
    'billing:read',
    'security:read',
    'feature-flags:read',
    'system-config:read',
    'announcements:read',
    'analytics:read',
    'support:read',
  ],
};

// ─── Authorization Function ────────────────────────────────────────────

/**
 * Checks if a platform admin role has a given permission.
 * Fail-closed: returns false for unknown roles, null, undefined, or empty strings.
 * 
 * @param role - Platform admin role (super_admin, admin, readonly)
 * @param permission - Permission string (e.g., 'users:write')
 * @returns true if the role has the permission, false otherwise
 * 
 * @example
 * can('super_admin', 'admins:write') // true
 * can('admin', 'users:write') // true
 * can('admin', 'admins:write') // false
 * can('readonly', 'users:read') // true
 * can('readonly', 'users:write') // false
 * can(null, 'users:read') // false
 * can('SUPER_ADMIN', 'users:read') // false (case-sensitive)
 */
export function can(
  role: string | null | undefined,
  permission: PlatformPermission
): boolean {
  // Fail-closed: reject null, undefined, empty string, or unknown roles
  if (!role || typeof role !== 'string') {
    return false;
  }
  
  // Case-sensitive role check (reject 'SUPER_ADMIN', 'Admin', etc.)
  if (role !== 'super_admin' && role !== 'admin' && role !== 'readonly') {
    return false;
  }
  
  // Type-safe access after validation
  const platformRole = role as PlatformRole;
  
  return PERMISSION_MATRIX[platformRole].includes(permission);
}
