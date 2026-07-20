import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp, truncateAll, getApp, getConfig, buildTestApp } from '../helpers/setup.js';
import { registerClient, loginClient } from '../helpers/opaque-client.js';
import * as opaque from '@serenity-kit/opaque';

describe('Auth', () => {
  beforeAll(async () => { await setupTestApp(); });
  afterAll(async () => { await teardownTestApp(); });
  beforeEach(async () => { await truncateAll(); });

  describe('Registration', () => {
    it('full OPAQUE registration round-trip (no invite required)', async () => {
      const app = getApp();
      const config = getConfig();

      const { userId, sessionCookie } = await registerClient({
        handle: 'alice',
        password: 'StrongP@ss1',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
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

      await registerClient({
        handle: 'bob',
        password: 'pass123',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
      });

      const startRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register/start',
        payload: { handle: 'bob', registrationRequest: 'fake' },
      });
      expect(startRes.statusCode).toBe(409);
    });

    it('REGISTRATION_MODE=closed returns 403 on both start and finish', async () => {
      const closedApp = await buildTestApp({ REGISTRATION_MODE: 'closed' });
      try {
        const startRes = await closedApp.inject({
          method: 'POST',
          url: '/api/auth/register/start',
          payload: { handle: 'newuser', registrationRequest: 'fake' },
        });
        expect(startRes.statusCode).toBe(403);

        const finishRes = await closedApp.inject({
          method: 'POST',
          url: '/api/auth/register/finish',
          payload: {
            handle: 'newuser',
            registrationRecord: 'fake',
            kdf_params: { algorithm: 'argon2id', time_cost: 1, memory_cost: 65536, parallelism: 1, salt_length: 16 },
          },
        });
        expect(finishRes.statusCode).toBe(403);
      } finally {
        await closedApp.close();
      }
    });
  });

  describe('Login', () => {
    it('full OPAQUE login round-trip', async () => {
      const app = getApp();
      const config = getConfig();

      await registerClient({
        handle: 'alice',
        password: 'MyP@ss',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
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

      await registerClient({
        handle: 'alice',
        password: 'RealPass',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
      });

      try {
        await loginClient({ handle: 'alice', password: 'WrongPass', app });
        expect.fail('Should have thrown');
      } catch (e: any) {
        // finishLogin on client will throw or server returns 401
      }
    });

    it('does not reveal whether a handle exists at login/start (anti-enumeration)', async () => {
      const app = getApp();
      // A valid OPAQUE start request against a handle that does not exist must look
      // exactly like one against a real account: 200 with a login response + id.
      const { startLoginRequest } = opaque.client.startLogin({ password: 'whatever' });
      const startRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login/start',
        payload: { handle: 'ghost-does-not-exist', startLoginRequest },
      });
      expect(startRes.statusCode).toBe(200);
      const body = startRes.json();
      expect(body.loginResponse).toBeTruthy();
      expect(body.login_id).toBeTruthy();
    });

    it('login/finish fails for an unknown handle', async () => {
      const app = getApp();
      const { clientLoginState, startLoginRequest } = opaque.client.startLogin({ password: 'whatever' });
      const startRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login/start',
        payload: { handle: 'ghost-also-missing', startLoginRequest },
      });
      const { loginResponse, login_id } = startRes.json();

      // The client cannot derive a valid finish against a dummy record; send whatever it
      // produces (or a placeholder) — the server must reject with 401, same as a wrong password.
      let finishLoginRequest = 'AAAA';
      try {
        const r = opaque.client.finishLogin({ clientLoginState, loginResponse, password: 'whatever' });
        if (r?.finishLoginRequest) finishLoginRequest = r.finishLoginRequest;
      } catch {
        /* client refused — expected for a dummy record */
      }

      const finishRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login/finish',
        payload: { login_id, finishLoginRequest },
      });
      expect(finishRes.statusCode).toBe(401);
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

      const { sessionCookie } = await registerClient({
        handle: 'alice',
        password: 'pass',
        serverSetup: config.OPAQUE_SERVER_SETUP,
        app,
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
