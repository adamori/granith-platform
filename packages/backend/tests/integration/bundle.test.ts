import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp, truncateAll, getApp, getConfig, createInviteCode } from '../helpers/setup.js';
import { registerClient } from '../helpers/opaque-client.js';
import { fakeProjectPayload, fakeSecretPayload, fakeTokenPayload } from '../helpers/fixtures.js';

describe('Bundle', () => {
  beforeAll(async () => { await setupTestApp(); });
  afterAll(async () => { await teardownTestApp(); });
  beforeEach(async () => { await truncateAll(); });

  async function setupProjectWithTokenAndSecret() {
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

    const projRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { session: sessionCookie },
      payload: fakeProjectPayload(),
    });
    const projectId = projRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/secrets`,
      cookies: { session: sessionCookie },
      payload: fakeSecretPayload(),
    });

    const { body, rawToken } = fakeTokenPayload(projectId);
    await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/tokens`,
      cookies: { session: sessionCookie },
      payload: body,
    });

    return { app, rawToken, projectId, sessionCookie };
  }

  it('GET /v1/bundle returns bundle with ETag', async () => {
    const { app, rawToken } = await setupProjectWithTokenAndSecret();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/bundle',
      headers: { authorization: `Bearer ${rawToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['etag']).toBeDefined();

    const bundle = res.json();
    expect(bundle.project).toBeDefined();
    expect(bundle.wrapped_pdk).toBeDefined();
    expect(bundle.secrets).toHaveLength(1);
  });

  it('returns 304 on If-None-Match', async () => {
    const { app, rawToken } = await setupProjectWithTokenAndSecret();

    const firstRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bundle',
      headers: { authorization: `Bearer ${rawToken}` },
    });
    const etag = firstRes.headers['etag'] as string;

    const secondRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bundle',
      headers: {
        authorization: `Bearer ${rawToken}`,
        'if-none-match': etag,
      },
    });
    expect(secondRes.statusCode).toBe(304);
  });

  it('rejects invalid token format', async () => {
    const app = getApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/bundle',
      headers: { authorization: 'Bearer bad-token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects revoked token', async () => {
    const { app, rawToken, projectId, sessionCookie } = await setupProjectWithTokenAndSecret();

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/tokens`,
      cookies: { session: sessionCookie },
    });
    const tokenId = listRes.json().tokens[0].token_id;

    await app.inject({
      method: 'DELETE',
      url: `/api/tokens/${tokenId}`,
      cookies: { session: sessionCookie },
    });

    const bundleRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bundle',
      headers: { authorization: `Bearer ${rawToken}` },
    });
    expect(bundleRes.statusCode).toBe(401);
    expect(bundleRes.json().message).toContain('revoked');
  });

  it('rejects expired token', async () => {
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

    const projRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { session: sessionCookie },
      payload: fakeProjectPayload(),
    });
    const projectId = projRes.json().id;

    const { body, rawToken } = fakeTokenPayload(projectId);
    body.expires_at = new Date(Date.now() - 1000).toISOString(); // already expired

    await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/tokens`,
      cookies: { session: sessionCookie },
      payload: body,
    });

    const bundleRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bundle',
      headers: { authorization: `Bearer ${rawToken}` },
    });
    expect(bundleRes.statusCode).toBe(401);
    expect(bundleRes.json().message).toContain('expired');
  });

  it('enforces IP allowlist', async () => {
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

    const projRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { session: sessionCookie },
      payload: fakeProjectPayload(),
    });
    const projectId = projRes.json().id;

    const { body, rawToken } = fakeTokenPayload(projectId);
    body.ip_allowlist = ['10.99.99.99']; // not the test client IP

    await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/tokens`,
      cookies: { session: sessionCookie },
      payload: body,
    });

    const bundleRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bundle',
      headers: { authorization: `Bearer ${rawToken}` },
    });
    expect(bundleRes.statusCode).toBe(403);
    expect(bundleRes.json().message).toContain('IP');
  });
});
