/**
 * @jest-environment node
 *
 * CSRF Protection Tests — VAL-CSRF-001, VAL-CSRF-002, VAL-CSRF-003
 *
 * Verifies that CSRF protection is enforced on all mutating admin routes:
 *  1. Mutating request with valid session but no x-csrf-token header returns 403 and performs no mutation (VAL-CSRF-001)
 *  2. Mutating request with mismatched token returns 403 and performs no mutation (VAL-CSRF-001)
 *  3. Mutating request with matching cookie+header token succeeds and performs mutation (VAL-CSRF-002)
 *  4. GET requests work without any CSRF token (VAL-CSRF-003)
 *
 * Tests cover 5+ mutating routes: admins, users, billing, feature-flags, announcements
 */

// ─── Module mocks (must be before imports) ────────────────────────────

jest.mock('@lineky/database', () => ({
  db: {
    platformAdmin: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    featureFlag: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    announcement: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Get references to the mocked functions after the mock is set up
const mockPlatformAdminFindMany = require('@lineky/database').db.platformAdmin.findMany as jest.Mock;
const mockPlatformAdminFindUnique = require('@lineky/database').db.platformAdmin.findUnique as jest.Mock;
const mockPlatformAdminCreate = require('@lineky/database').db.platformAdmin.create as jest.Mock;
const mockPlatformAdminUpdate = require('@lineky/database').db.platformAdmin.update as jest.Mock;
const mockPlatformAdminDelete = require('@lineky/database').db.platformAdmin.delete as jest.Mock;
const mockUserFindMany = require('@lineky/database').db.user.findMany as jest.Mock;
const mockUserFindUnique = require('@lineky/database').db.user.findUnique as jest.Mock;
const mockUserUpdate = require('@lineky/database').db.user.update as jest.Mock;
const mockSubscriptionFindMany = require('@lineky/database').db.subscription.findMany as jest.Mock;
const mockSubscriptionFindUnique = require('@lineky/database').db.subscription.findUnique as jest.Mock;
const mockSubscriptionUpdate = require('@lineky/database').db.subscription.update as jest.Mock;
const mockFeatureFlagFindMany = require('@lineky/database').db.featureFlag.findMany as jest.Mock;
const mockFeatureFlagFindUnique = require('@lineky/database').db.featureFlag.findUnique as jest.Mock;
const mockFeatureFlagCreate = require('@lineky/database').db.featureFlag.create as jest.Mock;
const mockFeatureFlagUpdate = require('@lineky/database').db.featureFlag.update as jest.Mock;
const mockFeatureFlagDelete = require('@lineky/database').db.featureFlag.delete as jest.Mock;
const mockAnnouncementFindMany = require('@lineky/database').db.announcement.findMany as jest.Mock;
const mockAnnouncementCreate = require('@lineky/database').db.announcement.create as jest.Mock;
const mockAnnouncementDelete = require('@lineky/database').db.announcement.delete as jest.Mock;
const mockAnnouncementFindUnique = require('@lineky/database').db.announcement.findUnique as jest.Mock;
const mockAnnouncementUpdate = require('@lineky/database').db.announcement.update as jest.Mock;
const mockWorkspaceFindUnique = require('@lineky/database').db.workspace.findUnique as jest.Mock;
const mockWorkspaceFindMany = require('@lineky/database').db.workspace.findMany as jest.Mock;

const mockGetUser = jest.fn();

jest.mock('@lineky/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

jest.mock('@lineky/platform-auth', () => {
  const actual = jest.requireActual('@lineky/platform-auth');
  return {
    ...actual,
    checkPlatformAdmin: jest.fn().mockResolvedValue({
      isAdmin: true,
      admin: {
        id: 'admin-001',
        email: 'admin@example.com',
        role: 'super_admin',
        isActive: true,
        twoFactorEnabled: false,
        allowedIps: null,
      },
    }),
    getPlatformAdminEmails: jest.fn().mockReturnValue(['admin@example.com']),
  };
});

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/services/email-config', () => ({
  invalidateResendApiKeyCache: jest.fn(),
}));

jest.mock('next-intl', () => ({
  getLocale: jest.fn().mockResolvedValue('fr'),
  getTranslations: jest.fn().mockResolvedValue(() => (key: string) => key),
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────

import { NextRequest } from 'next/server';
import { GET as getAdmins, POST as postAdmins, PATCH as patchAdmins, DELETE as deleteAdmins } from '@/app/api/admin/admins/route';
import { GET as getUsers, PATCH as patchUsers } from '@/app/api/admin/users/route';
import { GET as getBilling, PATCH as patchBilling } from '@/app/api/admin/billing/route';
import { GET as getFeatureFlags, POST as postFeatureFlags, DELETE as deleteFeatureFlags } from '@/app/api/admin/feature-flags/route';
import { GET as getAnnouncements, PATCH as patchAnnouncements, DELETE as deleteAnnouncements } from '@/app/api/admin/announcements/route';
import { createClient } from '@lineky/supabase/server';
import { __setCreateClientFactory, __setCheckPlatformAdmin } from '@lineky/platform-auth/admin-guard';

// Mock checkPlatformAdmin function
const mockCheckPlatformAdminFn = jest.fn();

// Set up global createClient factory for the admin guard
beforeAll(() => {
  __setCreateClientFactory(createClient);
  __setCheckPlatformAdmin(mockCheckPlatformAdminFn as any);
});

afterAll(() => {
  __setCreateClientFactory(null);
  __setCheckPlatformAdmin(null);
});

// ─── Test Helpers ──────────────────────────────────────────────────────

function createMockRequest(options: {
  method: string;
  body?: any;
  csrfCookie?: string;
  csrfHeader?: string;
}): NextRequest {
  const url = 'http://localhost:3000/api/admin/test';
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (options.csrfHeader) {
    headers['x-csrf-token'] = options.csrfHeader;
  }

  const init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  } = {
    method: options.method,
    headers,
  };

  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  const req = new NextRequest(url, init);

  // Mock cookies
  if (options.csrfCookie) {
    Object.defineProperty(req, 'cookies', {
      value: {
        get: (name: string) => {
          if (name === '__Host-csrf-token') {
            return { value: options.csrfCookie };
          }
          return undefined;
        },
      },
      writable: false,
    });
  }

  return req;
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe('CSRF Protection on Admin Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default: valid super_admin session
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-001', email: 'admin@example.com' } },
      error: null,
    });
    
    // Default: checkPlatformAdmin returns valid super_admin
    mockCheckPlatformAdminFn.mockResolvedValue({
      isAdmin: true,
      admin: {
        id: 'admin-001',
        email: 'admin@example.com',
        role: 'super_admin',
        isActive: true,
        twoFactorEnabled: false,
        allowedIps: null,
      },
      source: 'env',
    });
    
    // Default: empty database responses
    mockPlatformAdminFindMany.mockResolvedValue([]);
    mockPlatformAdminFindUnique.mockResolvedValue(null);
    mockUserFindMany.mockResolvedValue([]);
    mockUserFindUnique.mockResolvedValue(null);
    mockFeatureFlagFindMany.mockResolvedValue([]);
    mockFeatureFlagFindUnique.mockResolvedValue(null);
    mockAnnouncementFindMany.mockResolvedValue([]);
    mockAnnouncementFindUnique.mockResolvedValue(null);
    mockSubscriptionFindMany.mockResolvedValue([]);
    mockSubscriptionFindUnique.mockResolvedValue(null);
    mockWorkspaceFindMany.mockResolvedValue([]);
    mockWorkspaceFindUnique.mockResolvedValue(null);
  });

  // ─── VAL-CSRF-003: GET requests work without CSRF token ─────────────

  describe('VAL-CSRF-003: GET requests do not require CSRF token', () => {
    it('GET /api/admin/admins succeeds without CSRF token', async () => {
      const req = createMockRequest({ method: 'GET' });
      const res = await getAdmins(req);
      
      expect(res.status).toBe(200);
      expect(mockPlatformAdminFindMany).toHaveBeenCalled();
    });

    it('GET /api/admin/users succeeds without CSRF token', async () => {
      const req = createMockRequest({ method: 'GET' });
      const res = await getUsers(req);
      
      expect(res.status).toBe(200);
      expect(mockUserFindMany).toHaveBeenCalled();
    });

    it('GET /api/admin/feature-flags succeeds without CSRF token', async () => {
      const req = createMockRequest({ method: 'GET' });
      const res = await getFeatureFlags(req);
      
      expect(res.status).toBe(200);
      expect(mockFeatureFlagFindMany).toHaveBeenCalled();
    });

    it('GET /api/admin/announcements succeeds without CSRF token', async () => {
      const req = createMockRequest({ method: 'GET' });
      const res = await getAnnouncements(req);
      
      expect(res.status).toBe(200);
      expect(mockAnnouncementFindMany).toHaveBeenCalled();
    });

    it('GET /api/admin/billing succeeds without CSRF token', async () => {
      // GET billing calls subscription.findMany 7 times (main + 6 from buildMrrHistory)
      // and workspace.findMany once (line 186 for free workspaces)
      mockSubscriptionFindMany
        .mockResolvedValueOnce([])  // Main query
        .mockResolvedValueOnce([])  // Month 1
        .mockResolvedValueOnce([])  // Month 2
        .mockResolvedValueOnce([])  // Month 3
        .mockResolvedValueOnce([])  // Month 4
        .mockResolvedValueOnce([])  // Month 5
        .mockResolvedValueOnce([]); // Month 6
      
      mockWorkspaceFindMany.mockResolvedValueOnce([]);  // Free workspaces query
      
      const req = createMockRequest({ method: 'GET' });
      const res = await getBilling(req);
      
      expect(res.status).toBe(200);
      expect(mockSubscriptionFindMany).toHaveBeenCalledTimes(7);
    });
  });

  // ─── VAL-CSRF-001: Mutations without token are rejected ─────────────

  describe('VAL-CSRF-001: Mutations without CSRF token return 403', () => {
    it('POST /api/admin/admins with no CSRF header returns 403 and performs no mutation', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: { email: 'new@example.com', role: 'admin' },
        csrfCookie: 'token-123',
        // No csrfHeader
      });
      
      const res = await postAdmins(req);
      const json = await res.json();
      
      expect(res.status).toBe(403);
      expect(json.error).toMatch(/csrf/i);
      expect(mockPlatformAdminCreate).not.toHaveBeenCalled();
    });

    it('PATCH /api/admin/users with no CSRF cookie returns 403 and performs no mutation', async () => {
      const req = createMockRequest({
        method: 'PATCH',
        body: { userId: 'user-001', action: 'toggle-active' },
        // No csrfCookie or csrfHeader
      });
      
      const res = await patchUsers(req);
      const json = await res.json();
      
      expect(res.status).toBe(403);
      expect(json.error).toMatch(/csrf/i);
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it('POST /api/admin/feature-flags with no CSRF token returns 403 and performs no mutation', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: { key: 'new-feature', name: 'New Feature', enabled: true },
      });
      
      const res = await postFeatureFlags(req);
      const json = await res.json();
      
      expect(res.status).toBe(403);
      expect(json.error).toMatch(/csrf/i);
      expect(mockFeatureFlagCreate).not.toHaveBeenCalled();
    });

    it('DELETE /api/admin/announcements with no CSRF token returns 403 and performs no mutation', async () => {
      const req = createMockRequest({
        method: 'DELETE',
        body: { announcementId: 'ann-001' },
      });
      
      const res = await deleteAnnouncements(req);
      const json = await res.json();
      
      expect(res.status).toBe(403);
      expect(json.error).toMatch(/csrf/i);
      expect(mockAnnouncementDelete).not.toHaveBeenCalled();
    });

    it('PATCH /api/admin/billing with no CSRF token returns 403 and performs no mutation', async () => {
      const req = createMockRequest({
        method: 'PATCH',
        body: { workspaceId: 'ws-001', action: 'cancel' },
      });
      
      const res = await patchBilling(req);
      const json = await res.json();
      
      expect(res.status).toBe(403);
      expect(json.error).toMatch(/csrf/i);
      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
    });

    it('PATCH /api/admin/admins with mismatched token returns 403 and performs no mutation', async () => {
      const req = createMockRequest({
        method: 'PATCH',
        body: { adminId: 'admin-001', action: 'toggle-active' },
        csrfCookie: 'token-123',
        csrfHeader: 'token-456', // Mismatch
      });
      
      const res = await patchAdmins(req);
      const json = await res.json();
      
      expect(res.status).toBe(403);
      expect(json.error).toMatch(/csrf/i);
      expect(mockPlatformAdminUpdate).not.toHaveBeenCalled();
    });

    it('DELETE /api/admin/feature-flags with mismatched token returns 403 and performs no mutation', async () => {
      const req = createMockRequest({
        method: 'DELETE',
        body: { flagId: 'flag-001' },
        csrfCookie: 'abc',
        csrfHeader: 'xyz', // Mismatch
      });
      
      const res = await deleteFeatureFlags(req);
      const json = await res.json();
      
      expect(res.status).toBe(403);
      expect(json.error).toMatch(/csrf/i);
      expect(mockFeatureFlagDelete).not.toHaveBeenCalled();
    });
  });

  // ─── VAL-CSRF-002: Mutations with valid token succeed ───────────────

  describe('VAL-CSRF-002: Mutations with valid CSRF token succeed', () => {
    it('POST /api/admin/admins with matching token succeeds and performs mutation', async () => {
      const token = 'valid-token-123';
      mockPlatformAdminCreate.mockResolvedValue({
        id: 'admin-002',
        email: 'new@example.com',
        role: 'admin',
        isActive: true,
      });
      
      const req = createMockRequest({
        method: 'POST',
        body: { email: 'new@example.com', role: 'admin' },
        csrfCookie: token,
        csrfHeader: token,
      });
      
      const res = await postAdmins(req);
      
      expect(res.status).toBe(200);
      expect(mockPlatformAdminCreate).toHaveBeenCalledTimes(1);
    });

    it('PATCH /api/admin/users with matching token succeeds and performs mutation', async () => {
      const token = 'valid-token-456';
      mockUserFindUnique.mockResolvedValue({ id: 'user-001', isActive: true });
      mockUserUpdate.mockResolvedValue({ id: 'user-001', isActive: false });
      
      const req = createMockRequest({
        method: 'PATCH',
        body: { userId: 'user-001', action: 'toggle-active' },
        csrfCookie: token,
        csrfHeader: token,
      });
      
      const res = await patchUsers(req);
      
      expect(res.status).toBe(200);
      expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    });

    it('POST /api/admin/feature-flags with matching token succeeds and performs mutation', async () => {
      const token = 'valid-token-789';
      mockFeatureFlagFindUnique.mockResolvedValue(null); // No existing flag
      mockFeatureFlagCreate.mockResolvedValue({
        id: 'flag-001',
        key: 'new_feature',
        name: 'New Feature',
        isEnabled: true,
      });
      
      const req = createMockRequest({
        method: 'POST',
        body: { key: 'new-feature', name: 'New Feature', isEnabled: true },
        csrfCookie: token,
        csrfHeader: token,
      });
      
      const res = await postFeatureFlags(req);
      
      expect(res.status).toBe(200);
      expect(mockFeatureFlagCreate).toHaveBeenCalledTimes(1);
    });

    it('PATCH /api/admin/announcements with matching token succeeds and performs mutation', async () => {
      const token = 'valid-token-abc';
      mockAnnouncementFindUnique.mockResolvedValue({
        id: 'ann-001',
        isActive: true,
      });
      mockAnnouncementUpdate.mockResolvedValue({
        id: 'ann-001',
        isActive: false,
      });
      
      const req = createMockRequest({
        method: 'PATCH',
        body: { announcementId: 'ann-001', action: 'toggle-active' },
        csrfCookie: token,
        csrfHeader: token,
      });
      
      const res = await patchAnnouncements(req);
      
      expect(res.status).toBe(200);
      expect(mockAnnouncementUpdate).toHaveBeenCalledTimes(1);
    });

    it('DELETE /api/admin/admins with matching token succeeds and performs mutation', async () => {
      const token = 'valid-token-def';
      mockPlatformAdminFindUnique.mockResolvedValue({ id: 'admin-002', email: 'admin2@example.com', role: 'admin', isActive: true });
      mockPlatformAdminDelete.mockResolvedValue({ id: 'admin-002' });
      
      const req = createMockRequest({
        method: 'DELETE',
        body: { adminId: 'admin-002' },
        csrfCookie: token,
        csrfHeader: token,
      });
      
      const res = await deleteAdmins(req);
      
      expect(res.status).toBe(200);
      expect(mockPlatformAdminDelete).toHaveBeenCalledTimes(1);
    });

    it('PATCH /api/admin/billing with matching token succeeds and performs mutation', async () => {
      const token = 'valid-token-ghi';
      // Mock workspace.findUnique (the route calls this, not subscription.findUnique directly)
      mockWorkspaceFindUnique.mockResolvedValue({
        id: 'ws-001',
        subscription: {
          id: 'sub-001',
          status: 'trialing',
          workspaceId: 'ws-001',
          trialStart: new Date(),
          trialEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      mockSubscriptionUpdate.mockResolvedValue({
        id: 'sub-001',
        status: 'trialing',
        trialEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      
      const req = createMockRequest({
        method: 'PATCH',
        body: { workspaceId: 'ws-001', action: 'extend-trial', days: 30 },
        csrfCookie: token,
        csrfHeader: token,
      });
      
      const res = await patchBilling(req);
      
      expect(res.status).toBe(200);
      expect(mockSubscriptionUpdate).toHaveBeenCalledTimes(1);
    });
  });
});
