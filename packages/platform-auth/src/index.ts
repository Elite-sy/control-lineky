/**
 * @lineky/platform-auth — Platform Admin Authorization Package
 * 
 * Exports:
 * - Platform admin detection (checkPlatformAdmin, isPlatformAdmin)
 * - Permission matrix (can, PLATFORM_PERMISSIONS, PERMISSION_MATRIX)
 * - Admin guard middleware (withAdminAuth)
 * - CSRF protection (validateCsrf, generateCsrfToken, setCsrfCookie)
 * - Audit logging (logAdminAction, logAdminDenial)
 */

// Platform admin detection
export {
  getPlatformAdminEmails,
  isPlatformAdmin,
  checkPlatformAdmin,
  isIpAllowed,
  type AdminCheckResult,
} from './platform-admin';

// Permission matrix
export {
  can,
  PLATFORM_PERMISSIONS,
  PERMISSION_MATRIX,
  type PlatformPermission,
  type PlatformRole,
} from './platform-permissions';

// Admin guard
export { withAdminAuth, __setCreateClientFactory } from './admin-guard';

// CSRF protection
export {
  generateCsrfToken,
  setCsrfCookie,
  getCsrfTokenFromCookie,
  validateCsrf,
  getCsrfProtectionHeaders,
  CSRF_COOKIE_NAME,
} from './csrf';

// Audit logging
export { logAdminAction, logAdminDenial } from './audit/admin';
