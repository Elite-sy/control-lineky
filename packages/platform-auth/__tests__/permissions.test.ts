/**
 * Permission Matrix Tests — 66 tests (22 permissions × 3 roles)
 * 
 * Validates the platform admin permission matrix against the authoritative
 * requirements from validation-contract.md VAL-AUTH-003.
 */

import { can, PLATFORM_PERMISSIONS, PERMISSION_MATRIX } from '../src/platform-permissions';
import type { PlatformPermission, PlatformRole } from '../src/platform-permissions';

describe('Platform Permission Matrix', () => {
  // ─── Super Admin Role (22 tests) ─────────────────────────────────────

  describe('super_admin role', () => {
    it('should have all 22 permissions', () => {
      expect(PERMISSION_MATRIX.super_admin.length).toBe(22);
    });

    PLATFORM_PERMISSIONS.forEach((permission) => {
      it(`should grant ${permission}`, () => {
        expect(can('super_admin', permission)).toBe(true);
      });
    });
  });

  // ─── Admin Role (22 tests) ───────────────────────────────────────────

  describe('admin role', () => {
    const adminGranted: PlatformPermission[] = [
      'admins:read',
      'audit:read',
      'users:read',
      'users:write',
      'workspaces:read',
      'workspaces:write',
      'billing:read',
      'billing:write',
      'security:read',
      'feature-flags:read',
      'feature-flags:write',
      'system-config:read',
      'announcements:read',
      'announcements:write',
      'analytics:read',
      'support:read',
    ];

    const adminDenied: PlatformPermission[] = [
      'admins:write',
      'audit:write',
      'security:write',
      'system-config:write',
      'analytics:write',
      'support:write',
    ];

    adminGranted.forEach((permission) => {
      it(`should grant ${permission}`, () => {
        expect(can('admin', permission)).toBe(true);
      });
    });

    adminDenied.forEach((permission) => {
      it(`should deny ${permission}`, () => {
        expect(can('admin', permission)).toBe(false);
      });
    });
  });

  // ─── Readonly Role (22 tests) ────────────────────────────────────────

  describe('readonly role', () => {
    const readonlyGranted: PlatformPermission[] = [
      'users:read',
      'workspaces:read',
      'billing:read',
      'security:read',
      'feature-flags:read',
      'system-config:read',
      'announcements:read',
      'analytics:read',
      'support:read',
    ];

    const readonlyDenied: PlatformPermission[] = [
      'admins:read',
      'admins:write',
      'audit:read',
      'audit:write',
      'users:write',
      'workspaces:write',
      'billing:write',
      'security:write',
      'feature-flags:write',
      'system-config:write',
      'announcements:write',
      'analytics:write',
      'support:write',
    ];

    readonlyGranted.forEach((permission) => {
      it(`should grant ${permission}`, () => {
        expect(can('readonly', permission)).toBe(true);
      });
    });

    readonlyDenied.forEach((permission) => {
      it(`should deny ${permission}`, () => {
        expect(can('readonly', permission)).toBe(false);
      });
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────

  describe('can() edge cases', () => {
    it('should deny null role', () => {
      expect(can(null, 'users:read')).toBe(false);
    });

    it('should deny undefined role', () => {
      expect(can(undefined, 'users:read')).toBe(false);
    });

    it('should deny empty string role', () => {
      expect(can('', 'users:read')).toBe(false);
    });

    it('should deny unknown role', () => {
      expect(can('unknown_role', 'users:read')).toBe(false);
    });

    it('should deny case-mismatched role (SUPER_ADMIN)', () => {
      expect(can('SUPER_ADMIN', 'users:read')).toBe(false);
    });

    it('should deny case-mismatched role (Admin)', () => {
      expect(can('Admin', 'users:read')).toBe(false);
    });
  });

  // ─── Matrix Completeness ─────────────────────────────────────────────

  describe('PERMISSION_MATRIX completeness', () => {
    it('should contain exactly 3 roles', () => {
      expect(Object.keys(PERMISSION_MATRIX)).toEqual(['super_admin', 'admin', 'readonly']);
    });

    it('super_admin should have all 22 permissions', () => {
      expect(PERMISSION_MATRIX.super_admin).toHaveLength(22);
      expect(PERMISSION_MATRIX.super_admin).toEqual(PLATFORM_PERMISSIONS);
    });

    it('admin should have 16 permissions', () => {
      expect(PERMISSION_MATRIX.admin).toHaveLength(16);
    });

    it('readonly should have 9 permissions', () => {
      expect(PERMISSION_MATRIX.readonly).toHaveLength(9);
    });

    it('all matrix permissions should be valid', () => {
      const allRoles: PlatformRole[] = ['super_admin', 'admin', 'readonly'];
      allRoles.forEach((role) => {
        PERMISSION_MATRIX[role].forEach((permission) => {
          expect(PLATFORM_PERMISSIONS).toContain(permission);
        });
      });
    });
  });
});
