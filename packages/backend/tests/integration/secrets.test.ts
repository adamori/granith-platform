import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp, truncateAll, getApp, getConfig, createInviteCode } from '../helpers/setup.js';
import { registerClient } from '../helpers/opaque-client.js';
import { fakeProjectPayload, fakeSecretPayload } from '../helpers/fixtures.js';

describe('Secrets', () => {
  beforeAll(async () => { await setupTestApp(); });
  afterAll(async () => { await teardownTestApp(); });
  beforeEach(async () => { await truncateAll(); });

  async function authedUserWithProject() {
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

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { session: sessionCookie },
      payload: fakeProjectPayload(),
    });
    const projectId = createRes.json().id;
    return { app, sessionCookie, projectId };
  }

  it('creates and lists secrets', async () => {
    const { app, sessionCookie, projectId } = await authedUserWithProject();

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/secrets`,
      cookies: { session: sessionCookie },
      payload: fakeSecretPayload(),
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.json().version).toBe(1);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/secrets`,
      cookies: { session: sessionCookie },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().secrets).toHaveLength(1);
  });

  it('PUT increments version', async () => {
    const { app, sessionCookie, projectId } = await authedUserWithProject();

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/secrets`,
      cookies: { session: sessionCookie },
      payload: fakeSecretPayload(),
    });
    const sid = createRes.json().id;

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/projects/${projectId}/secrets/${sid}`,
      cookies: { session: sessionCookie },
      payload: fakeSecretPayload(),
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().version).toBe(2);
  });

  it('DELETE soft deletes secret', async () => {
    const { app, sessionCookie, projectId } = await authedUserWithProject();

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/secrets`,
      cookies: { session: sessionCookie },
      payload: fakeSecretPayload(),
    });
    const sid = createRes.json().id;

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${projectId}/secrets/${sid}`,
      cookies: { session: sessionCookie },
    });
    expect(delRes.statusCode).toBe(204);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/secrets`,
      cookies: { session: sessionCookie },
    });
    expect(listRes.json().secrets).toHaveLength(0);
  });

  it('rejects access to other user project secrets', async () => {
    const { app, projectId } = await authedUserWithProject();
    const config = getConfig();
    const inviteCode2 = await createInviteCode('inv2');
    const { sessionCookie: otherCookie } = await registerClient({
      handle: 'bob',
      password: 'pass',
      serverSetup: config.OPAQUE_SERVER_SETUP,
      app,
      inviteCode: inviteCode2,
    });

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/secrets`,
      cookies: { session: otherCookie },
    });
    expect(listRes.statusCode).toBe(404);
  });
});
