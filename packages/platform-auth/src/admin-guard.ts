import { NextRequest, NextResponse } from 'next/server';
import { checkPlatformAdmin } from './platform-admin';
import { can } from './platform-permissions';
import type { PlatformPermission } from './platform-permissions';
import { validateCsrf } from './csrf';
import { logAdminDenial } from './audit/admin';

// Module-level factory for dependency injection in tests
let globalCreateClientFactory: (() => Promise<any>) | null = null;
let globalCheckPlatformAdmin: typeof checkPlatformAdmin = checkPlatformAdmin;

/**
 * Set a global createClient factory for testing purposes
 * @internal
 */
export function __setCreateClientFactory(factory: (() => Promise<any>) | null) {
  globalCreateClientFactory = factory;
}

/**
 * Set a global checkPlatformAdmin function for testing purposes
 * @internal
 */
export function __setCheckPlatformAdmin(fn: typeof checkPlatformAdmin | null) {
  globalCheckPlatformAdmin = fn || checkPlatformAdmin;
}

/**
 * Admin authorization guard for Next.js API routes.
 * 
 * Wraps a route handler and enforces:
 * 1. Valid Supabase session (401 if missing)
 * 2. Active platform admin via checkPlatformAdmin (403 if not found or inactive)
 * 3. Required permission via can() (403 if denied)
 * 4. CSRF protection on mutating requests (403 if token missing or invalid)
 * 
 * Does NOT enforce allowedIps or twoFactorEnabled (per J0 decision).
 * 
 * Env-only admins (listed in PLATFORM_ADMIN_EMAILS but with no PlatformAdmin DB row)
 * are implicitly assigned super_admin role at J0. This prevents lockout while the
 * production database contains zero PlatformAdmin rows. Migrating to DB-backed admin
 * rows with explicit roles is a J1+ follow-up.
 * 
 * @param handler - The route handler to protect
 * @param permission - The required permission from platform-permissions
 * @param createClient - Supabase client factory (injected for testing)
 * @returns Guarded route handler
 */
export function withAdminAuth(
  handler: (request: NextRequest, context?: { adminEmail: string; adminId: string; adminRole: string }) => Promise<NextResponse>,
  permission: PlatformPermission,
  createClient?: () => Promise<any>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // 1. Check for valid Supabase session
    const supabaseClientFactory = createClient || globalCreateClientFactory;
    
    if (!supabaseClientFactory) {
      return NextResponse.json(
        { error: 'Internal error: Supabase client factory not provided' },
        { status: 500 }
      );
    }

    const supabase = await supabaseClientFactory();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json(
        { error: 'Unauthorized: No valid session' },
        { status: 401 }
      );
    }

    // 2. Resolve admin identity through checkPlatformAdmin (unified DB + env check)
    const result = await globalCheckPlatformAdmin(user.email || '');

    if (!result.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Not a platform admin' },
        { status: 403 }
      );
    }

    // 3. Extract or synthesize admin identity
    // For env-only admins (isAdmin=true, admin=undefined), synthesize a safe identity.
    // Rationale: An email in PLATFORM_ADMIN_EMAILS is by definition a fully trusted
    // operator. Assigning super_admin preserves today's effective behavior (env-listed
    // admins currently pass every route with no role distinction). This prevents lockout
    // while the production DB has zero PlatformAdmin rows. Migrating to DB-backed admin
    // rows with explicit roles is a J1+ follow-up.
    let admin = result.admin;
    if (!admin && result.isAdmin) {
      // Synthesize admin identity for env-only path
      admin = {
        id: `env:${user.email}`,
        email: user.email!,
        role: 'super_admin',
        isActive: true,
        twoFactorEnabled: false,
        allowedIps: null,
      };
    }

    // If still no admin after synthesis, deny (isAdmin was false)
    if (!admin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin record not found' },
        { status: 403 }
      );
    }

    // 4. Check if admin is active
    if (!admin.isActive) {
      // Hook for audit logging: expose admin and denial reason
      onAdminDenial(admin, permission, 'inactive');
      
      return NextResponse.json(
        { error: 'Forbidden: Admin account inactive' },
        { status: 403 }
      );
    }

    // 5. Check permission
    if (!can(admin.role, permission)) {
      // Hook for audit logging: expose admin and denial reason
      onAdminDenial(admin, permission, 'insufficient_permissions');
      
      return NextResponse.json(
        { error: `Forbidden: Insufficient permissions for ${permission}` },
        { status: 403 }
      );
    }

    // 6. CSRF protection on mutating requests
    // Safe methods (GET, HEAD, OPTIONS) are exempt from CSRF validation
    const method = request.method.toUpperCase();
    const isMutatingMethod = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
    
    if (isMutatingMethod) {
      const csrfResult = validateCsrf(request);
      
      if (!csrfResult.valid) {
        // Hook for audit logging: expose admin and denial reason
        onAdminDenial(admin, permission, 'csrf_validation_failed');
        
        return NextResponse.json(
          { error: `Forbidden: ${csrfResult.error}` },
          { status: 403 }
        );
      }
    }

    // 7. All checks passed - invoke the route handler with admin context
    const context = {
      adminEmail: admin.email,
      adminId: admin.id,
      adminRole: admin.role,
    };
    
    return handler(request, context);
  };
}

/**
 * Hook for audit logging of admin denials.
 * Can be extended later without duplicating authorization logic.
 */
function onAdminDenial(
  admin: { id: string; email: string; role: string },
  permission: PlatformPermission,
  reason: 'inactive' | 'insufficient_permissions' | 'csrf_validation_failed'
): void {
  // Log denial to audit trail - must never throw to avoid converting 403 to 500
  try {
    void logAdminDenial({
      actorEmail: admin.email,
      route: permission,
      permission,
      details: { reason, role: admin.role },
    });
  } catch (error) {
    console.error('[Admin Guard] Failed to log denial:', error);
  }
}
