import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp, truncateAll, getApp, getConfig, createInviteCode } from '../helpers/setup.js';
import { registerClient } from '../helpers/opaque-client.js';

describe('Admin', () => {
  beforeAll(async () => { await setupTestApp(); });
  afterAll(async () => { await teardownTestApp(); });
  beforeEach(async () => { await truncateAll(); });

  const adminHeaders = { authorization: `Bearer test-admin-key-that-is-at-least-32-chars-long!` };

  describe('Invites', () => {
    it('creates invite codes', async () => {
      const app = getApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/invites',
        headers: adminHeaders,
        payload: { ttl: '7d', count: 3 },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().codes).toHaveLength(3);
      expect(res.json().expires_at).toBeDefined();
    });

    it('lists invite codes', async () => {
      const app = getApp();
      await createInviteCode('inv-1');
      await createInviteCode('inv-2');

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/invites',
        headers: adminHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().invites).toHaveLength(2);
    });

    it('revokes (deletes) unused invite', async () => {
      const app = getApp();
      await createInviteCode('to-revoke');

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/invites/to-revoke',
        headers: adminHeaders,
      });
      expect(res.statusCode).toBe(204);

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/admin/invites',
        headers: adminHeaders,
      });
      expect(listRes.json().invites).toHaveLength(0);
    });

    it('cannot revoke used invite', async () => {
      const app = getApp();
      const config = getConfig();
      const code = await createInviteCode('used-one');

      await registerClient({
        handle: 'alice',
        password: 'pass',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
        inviteCode: code,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/invites/${code}`,
        headers: adminHeaders,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Users', () => {
    it('lists users', async () => {
      const app = getApp();
      const config = getConfig();
      const inviteCode = await createInviteCode();
      await registerClient({
        handle: 'alice',
        password: 'pass',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
        inviteCode,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: adminHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().users).toHaveLength(1);
      expect(res.json().users[0].handle).toBe('alice');
    });

    it('deletes user by handle', async () => {
      const app = getApp();
      const config = getConfig();
      const inviteCode = await createInviteCode();
      await registerClient({
        handle: 'alice',
        password: 'pass',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
        inviteCode,
      });

      const delRes = await app.inject({
        method: 'DELETE',
        url: '/api/admin/users/alice',
        headers: adminHeaders,
      });
      expect(delRes.statusCode).toBe(204);

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: adminHeaders,
      });
      expect(listRes.json().users).toHaveLength(0);
    });
  });

  describe('Auth guard', () => {
    it('rejects missing admin key', async () => {
      const app = getApp();
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects wrong admin key', async () => {
      const app = getApp();
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: 'Bearer wrong-key' },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
