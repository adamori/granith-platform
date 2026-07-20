import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp, truncateAll, getApp, getConfig } from '../helpers/setup.js';
import { registerClient } from '../helpers/opaque-client.js';

describe('Admin', () => {
  beforeAll(async () => { await setupTestApp(); });
  afterAll(async () => { await teardownTestApp(); });
  beforeEach(async () => { await truncateAll(); });

  const adminHeaders = { authorization: `Bearer test-admin-key-that-is-at-least-32-chars-long!` };

  async function registerAlice() {
    const config = getConfig();
    return registerClient({
      handle: 'alice',
      password: 'pass',
      serverSetup: config.OPAQUE_SERVER_SETUP,
      app: getApp(),
    });
  }

  describe('Limits', () => {
    it('shows default limits for a user with no override', async () => {
      const app = getApp();
      await registerAlice();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users/alice/limits',
        headers: adminHeaders,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.handle).toBe('alice');
      expect(body.limit_overrides).toBeNull();
      expect(body.effective.storage_bytes).toBe(1048576);
      expect(body.used_bytes).toBe(0);
    });

    it('sets a storage override', async () => {
      const app = getApp();
      await registerAlice();

      const setRes = await app.inject({
        method: 'PUT',
        url: '/api/admin/users/alice/limits',
        headers: adminHeaders,
        payload: { storage_bytes: 5000 },
      });
      expect(setRes.statusCode).toBe(200);

      const showRes = await app.inject({
        method: 'GET',
        url: '/api/admin/users/alice/limits',
        headers: adminHeaders,
      });
      const body = showRes.json();
      expect(body.limit_overrides).toEqual({ storage_bytes: 5000 });
      expect(body.effective.storage_bytes).toBe(5000);
    });

    it('clears a storage override', async () => {
      const app = getApp();
      await registerAlice();

      await app.inject({
        method: 'PUT',
        url: '/api/admin/users/alice/limits',
        headers: adminHeaders,
        payload: { storage_bytes: 5000 },
      });

      const clearRes = await app.inject({
        method: 'PUT',
        url: '/api/admin/users/alice/limits',
        headers: adminHeaders,
        payload: { storage_bytes: null },
      });
      expect(clearRes.statusCode).toBe(200);

      const showRes = await app.inject({
        method: 'GET',
        url: '/api/admin/users/alice/limits',
        headers: adminHeaders,
      });
      const body = showRes.json();
      expect(body.limit_overrides).toBeNull();
      expect(body.effective.storage_bytes).toBe(1048576);
    });

    it('returns 404 for an unknown handle', async () => {
      const app = getApp();
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users/nobody/limits',
        headers: adminHeaders,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Users', () => {
    it('lists users', async () => {
      const app = getApp();
      await registerAlice();

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
      await registerAlice();

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
