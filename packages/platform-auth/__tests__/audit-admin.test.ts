// Test for audit logging in admin mutations and denials
import { logAdminAction } from '../src/audit/admin';
import { db } from '@lineky/database';

jest.mock('@lineky/database', () => ({
  db: {
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'test_id' }),
    },
  },
}));

// Mock Next.js headers() function
jest.mock('next/headers', () => ({
  headers: jest.fn(async () => ({
    get: jest.fn((key: string) => {
      if (key === 'x-forwarded-for') return '127.0.0.1';
      if (key === 'user-agent') return 'test-agent';
      return null;
    }),
  })),
}));

describe('Admin Audit Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // VAL-AUDIT-001: Mutation sensible journalisée
  describe('VAL-AUDIT-001: Sensitive mutations logged', () => {
    it('writes audit entry with actor email for successful admin mutation', async () => {
      await logAdminAction({
        action: 'created',
        entityType: 'user',
        entityId: 'user_123',
        actorEmail: 'admin@example.com',
        workspaceId: 'ws_456',
        details: { name: 'Test User' },
      });

      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'created',
          entityType: 'user',
          entityId: 'user_123',
          userId: 'admin@example.com',
          workspaceId: 'ws_456',
        }),
      });
    });

    it('writes audit entry for admin creation', async () => {
      await logAdminAction({
        action: 'created',
        entityType: 'admin',
        entityId: 'admin_123',
        actorEmail: 'superadmin@example.com',
        details: { email: 'newadmin@example.com', role: 'admin' },
      });

      expect(db.auditLog.create).toHaveBeenCalledTimes(1);
      const call = (db.auditLog.create as jest.Mock).mock.calls[0][0];
      expect(call.data.userId).toBe('superadmin@example.com');
      expect(call.data.entityType).toBe('admin');
    });

    it('writes audit entry for billing mutation', async () => {
      await logAdminAction({
        action: 'updated',
        entityType: 'billing',
        entityId: 'sub_123',
        actorEmail: 'admin@example.com',
        workspaceId: 'ws_456',
        details: { plan: 'premium' },
      });

      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'updated',
          entityType: 'billing',
          workspaceId: 'ws_456',
        }),
      });
    });

    it('writes audit entry for feature flag mutation', async () => {
      await logAdminAction({
        action: 'updated',
        entityType: 'feature-flag',
        entityId: 'flag_123',
        actorEmail: 'admin@example.com',
        details: { enabled: true },
      });

      expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    });
  });

  // VAL-AUDIT-002: Refus d'autorisation journalisé
  describe('VAL-AUDIT-002: Permission denials logged', () => {
    it('writes audit entry for permission denial', async () => {
      await logAdminAction({
        action: 'denied',
        entityType: 'admin_permission',
        actorEmail: 'readonly@example.com',
        details: { route: '/api/admin/users', permission: 'users:write' },
      });

      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'denied',
          entityType: 'admin_permission',
          userId: 'readonly@example.com',
        }),
      });

      const call = (db.auditLog.create as jest.Mock).mock.calls[0][0];
      expect(call.data.details).toEqual(
        expect.objectContaining({
          route: '/api/admin/users',
          permission: 'users:write',
        })
      );
    });
  });

  // VAL-AUDIT-003: Secrets expurgés des détails d'audit
  describe('VAL-AUDIT-003: Secrets redacted from audit details', () => {
    it('redacts password from audit details', async () => {
      await logAdminAction({
        action: 'updated',
        entityType: 'user',
        entityId: 'user_123',
        actorEmail: 'admin@example.com',
        details: {
          password: 'secret123',
          name: 'Test User',
        },
      });

      const call = (db.auditLog.create as jest.Mock).mock.calls[0][0];
      const details = call.data.details;

      expect(details.password).toBe('[REDACTED]');
      expect(details.name).toBe('Test User');
    });

    it('redacts token from audit details', async () => {
      await logAdminAction({
        action: 'updated',
        entityType: 'user',
        entityId: 'user_123',
        actorEmail: 'admin@example.com',
        details: {
          token: 'bearer_token_12345',
          email: 'user@example.com',
        },
      });

      const call = (db.auditLog.create as jest.Mock).mock.calls[0][0];
      const details = call.data.details;

      expect(details.token).toBe('[REDACTED]');
      expect(details.email).toBe('user@example.com');
    });

    it('redacts apiKey from audit details', async () => {
      await logAdminAction({
        action: 'created',
        entityType: 'integration',
        entityId: 'int_123',
        actorEmail: 'admin@example.com',
        details: {
          apiKey: 'sk_test_12345',
          provider: 'stripe',
        },
      });

      const call = (db.auditLog.create as jest.Mock).mock.calls[0][0];
      const details = call.data.details;

      expect(details.apiKey).toBe('[REDACTED]');
      expect(details.provider).toBe('stripe');
    });

    it('redacts secret from audit details', async () => {
      await logAdminAction({
        action: 'updated',
        entityType: 'config',
        entityId: 'cfg_123',
        actorEmail: 'admin@example.com',
        details: {
          secret: 'very_secret_value',
          totpSecret: 'JBSWY3DPEHPK3PXP',
          name: 'Config Name',
        },
      });

      const call = (db.auditLog.create as jest.Mock).mock.calls[0][0];
      const details = call.data.details;

      expect(details.secret).toBe('[REDACTED]');
      expect(details.totpSecret).toBe('[REDACTED]');
      expect(details.name).toBe('Config Name');
    });

    it('redacts authorization header from audit details', async () => {
      await logAdminAction({
        action: 'api_call',
        entityType: 'external',
        actorEmail: 'admin@example.com',
        details: {
          authorization: 'Bearer token123',
          endpoint: '/api/endpoint',
        },
      });

      const call = (db.auditLog.create as jest.Mock).mock.calls[0][0];
      const details = call.data.details;

      expect(details.authorization).toBe('[REDACTED]');
      expect(details.endpoint).toBe('/api/endpoint');
    });
  });
});
