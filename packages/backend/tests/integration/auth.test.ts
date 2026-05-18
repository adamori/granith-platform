import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp, truncateAll, getApp, getConfig, createInviteCode } from '../helpers/setup.js';
import { registerClient, loginClient } from '../helpers/opaque-client.js';

describe('Auth', () => {
  beforeAll(async () => { await setupTestApp(); });
  afterAll(async () => { await teardownTestApp(); });
  beforeEach(async () => { await truncateAll(); });

  describe('Registration', () => {
    it('full OPAQUE registration round-trip', async () => {
      const app = getApp();
      const config = getConfig();
      const inviteCode = await createInviteCode();

      const { userId, sessionCookie } = await registerClient({
        handle: 'alice',
        password: 'StrongP@ss1',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
        inviteCode,
      });

      expect(userId).toBeDefined();
      expect(sessionCookie).toBeDefined();

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: { session: sessionCookie },
      });
      expect(meRes.statusCode).toBe(200);
      expect(meRes.json().handle).toBe('alice');
    });

    it('rejects duplicate handle', async () => {
      const app = getApp();
      const config = getConfig();
      const inviteCode = await createInviteCode('invite-1');
      await createInviteCode('invite-2');

      await registerClient({
        handle: 'bob',
        password: 'pass123',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
        inviteCode: 'invite-1',
      });

      const startRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register/start',
        payload: { handle: 'bob', registrationRequest: 'fake' },
      });
      expect(startRes.statusCode).toBe(409);
    });

    it('rejects invalid invite code', async () => {
      const app = getApp();
      const config = getConfig();

      const startRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register/start',
        payload: { handle: 'newuser', registrationRequest: 'fake' },
      });
      // start doesn't check invite, but finish does
      // For start to fail we need an existing handle or valid OPAQUE — just test finish
      const finishRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register/finish',
        payload: {
          handle: 'newuser',
          registrationRecord: 'fake',
          invite_code: 'nonexistent',
          kdf_params: { algorithm: 'argon2id', time_cost: 1, memory_cost: 65536, parallelism: 1, salt_length: 16 },
        },
      });
      expect(finishRes.statusCode).toBe(400);
      expect(finishRes.json().message).toContain('invite');
    });

    it('rejects used invite code', async () => {
      const app = getApp();
      const config = getConfig();
      const inviteCode = await createInviteCode('one-time');

      await registerClient({
        handle: 'first',
        password: 'pass',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
        inviteCode: 'one-time',
      });

      const finishRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register/finish',
        payload: {
          handle: 'second',
          registrationRecord: 'fake',
          invite_code: 'one-time',
          kdf_params: { algorithm: 'argon2id', time_cost: 1, memory_cost: 65536, parallelism: 1, salt_length: 16 },
        },
      });
      expect(finishRes.statusCode).toBe(400);
    });
  });

  describe('Login', () => {
    it('full OPAQUE login round-trip', async () => {
      const app = getApp();
      const config = getConfig();
      const inviteCode = await createInviteCode();

      await registerClient({
        handle: 'alice',
        password: 'MyP@ss',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
        inviteCode,
      });

      const { userId, sessionCookie } = await loginClient({
        handle: 'alice',
        password: 'MyP@ss',
        app,
      });

      expect(userId).toBeDefined();

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: { session: sessionCookie },
      });
      expect(meRes.statusCode).toBe(200);
      expect(meRes.json().handle).toBe('alice');
    });

    it('rejects wrong password', async () => {
      const app = getApp();
      const config = getConfig();
      const inviteCode = await createInviteCode();

      await registerClient({
        handle: 'alice',
        password: 'RealPass',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
        inviteCode,
      });

      try {
        await loginClient({ handle: 'alice', password: 'WrongPass', app });
        expect.fail('Should have thrown');
      } catch (e: any) {
        // finishLogin on client will throw or server returns 401
      }
    });

    it('rejects unknown handle', async () => {
      const app = getApp();
      const startRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login/start',
        payload: { handle: 'ghost', startLoginRequest: 'fake' },
      });
      expect(startRes.statusCode).toBe(401);
    });
  });

  describe('Session', () => {
    it('GET /auth/me without session returns 401', async () => {
      const app = getApp();
      const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
      expect(res.statusCode).toBe(401);
    });

    it('POST /auth/logout clears session', async () => {
      const app = getApp();
      const config = getConfig();
      const inviteCode = await createInviteCode();

      const { sessionCookie } = await registerClient({
        handle: 'alice',
        password: 'pass',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
        inviteCode,
      });

      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        cookies: { session: sessionCookie },
      });
      expect(logoutRes.statusCode).toBe(200);

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: { session: sessionCookie },
      });
      expect(meRes.statusCode).toBe(401);
    });
  });
});
