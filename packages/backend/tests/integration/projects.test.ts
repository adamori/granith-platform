import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp, truncateAll, getApp, getConfig, createInviteCode } from '../helpers/setup.js';
import { registerClient } from '../helpers/opaque-client.js';
import { fakeProjectPayload } from '../helpers/fixtures.js';

describe('Projects', () => {
  beforeAll(async () => { await setupTestApp(); });
  afterAll(async () => { await teardownTestApp(); });
  beforeEach(async () => { await truncateAll(); });

  async function authedUser(handle = 'alice') {
    const config = getConfig();
    const inviteCode = await createInviteCode(`inv-${handle}`);
    return registerClient({
      handle,
      password: 'pass',
      serverSetup: config.OPAQUE_SERVER_SETUP,
      app: getApp(),
      inviteCode,
    });
  }

  it('creates and lists projects', async () => {
    const app = getApp();
    const { sessionCookie } = await authedUser();

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { session: sessionCookie },
      payload: fakeProjectPayload(),
    });
    expect(createRes.statusCode).toBe(201);
    const { id } = createRes.json();
    expect(id).toBeDefined();

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/projects',
      cookies: { session: sessionCookie },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().projects).toHaveLength(1);
    expect(listRes.json().projects[0].id).toBe(id);
  });

  it('GET /projects/:id returns project', async () => {
    const app = getApp();
    const { sessionCookie } = await authedUser();

    const payload = fakeProjectPayload();
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { session: sessionCookie },
      payload,
    });
    const { id } = createRes.json();

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${id}`,
      cookies: { session: sessionCookie },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().name_ct).toBe(payload.name_ct);
  });

  it('DELETE /projects/:id soft deletes', async () => {
    const app = getApp();
    const { sessionCookie } = await authedUser();

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { session: sessionCookie },
      payload: fakeProjectPayload(),
    });
    const { id } = createRes.json();

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${id}`,
      cookies: { session: sessionCookie },
    });
    expect(delRes.statusCode).toBe(204);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${id}`,
      cookies: { session: sessionCookie },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('isolates projects between users', async () => {
    const app = getApp();
    const { sessionCookie: cookie1 } = await authedUser('user1');
    const { sessionCookie: cookie2 } = await authedUser('user2');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { session: cookie1 },
      payload: fakeProjectPayload(),
    });
    const { id } = createRes.json();

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${id}`,
      cookies: { session: cookie2 },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('rejects unauthenticated requests', async () => {
    const app = getApp();
    const res = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(res.statusCode).toBe(401);
  });
});
