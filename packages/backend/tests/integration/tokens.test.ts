import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp, truncateAll, getApp, getConfig } from '../helpers/setup.js';
import { registerClient } from '../helpers/opaque-client.js';
import { fakeProjectPayload, fakeTokenPayload } from '../helpers/fixtures.js';

describe('Tokens', () => {
  beforeAll(async () => { await setupTestApp(); });
  afterAll(async () => { await teardownTestApp(); });
  beforeEach(async () => { await truncateAll(); });

  async function authedUserWithProject() {
    const app = getApp();
    const config = getConfig();
    const { sessionCookie } = await registerClient({
      handle: 'alice',
      password: 'pass',
      serverSetup: config.OPAQUE_SERVER_SETUP,
      app,
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { session: sessionCookie },
      payload: fakeProjectPayload(),
    });
    const projectId = createRes.json().id;
    return { app, sessionCookie, projectId };
  }

  it('creates and lists tokens', async () => {
    const { app, sessionCookie, projectId } = await authedUserWithProject();
    const { body } = fakeTokenPayload(projectId);

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/tokens`,
      cookies: { session: sessionCookie },
      payload: body,
    });
    expect(createRes.statusCode).toBe(201);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/tokens`,
      cookies: { session: sessionCookie },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().tokens).toHaveLength(1);
    expect(listRes.json().tokens[0].token_id).toBe(body.token_id);
  });

  it('revokes token (DELETE)', async () => {
    const { app, sessionCookie, projectId } = await authedUserWithProject();
    const { body } = fakeTokenPayload(projectId);

    await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/tokens`,
      cookies: { session: sessionCookie },
      payload: body,
    });

    const revokeRes = await app.inject({
      method: 'DELETE',
      url: `/api/tokens/${body.token_id}`,
      cookies: { session: sessionCookie },
    });
    expect(revokeRes.statusCode).toBe(204);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/tokens`,
      cookies: { session: sessionCookie },
    });
    expect(listRes.json().tokens[0].revoked_at).not.toBeNull();
  });

  it('PATCH updates ip_allowlist', async () => {
    const { app, sessionCookie, projectId } = await authedUserWithProject();
    const { body } = fakeTokenPayload(projectId);

    await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/tokens`,
      cookies: { session: sessionCookie },
      payload: body,
    });

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/tokens/${body.token_id}`,
      cookies: { session: sessionCookie },
      payload: { ip_allowlist: ['10.0.0.1'] },
    });
    expect(patchRes.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/tokens`,
      cookies: { session: sessionCookie },
    });
    expect(listRes.json().tokens[0].ip_allowlist).toEqual(['10.0.0.1']);
  });

  it('rejects patch on revoked token', async () => {
    const { app, sessionCookie, projectId } = await authedUserWithProject();
    const { body } = fakeTokenPayload(projectId);

    await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/tokens`,
      cookies: { session: sessionCookie },
      payload: body,
    });
    await app.inject({
      method: 'DELETE',
      url: `/api/tokens/${body.token_id}`,
      cookies: { session: sessionCookie },
    });

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/tokens/${body.token_id}`,
      cookies: { session: sessionCookie },
      payload: { ip_allowlist: ['10.0.0.1'] },
    });
    expect(patchRes.statusCode).toBe(404);
  });
});
