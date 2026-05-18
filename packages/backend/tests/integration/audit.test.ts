import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp, truncateAll, getApp, getConfig, createInviteCode } from '../helpers/setup.js';
import { registerClient } from '../helpers/opaque-client.js';
import { fakeProjectPayload, fakeSecretPayload } from '../helpers/fixtures.js';

describe('Audit log', () => {
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

    const projRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { session: sessionCookie },
      payload: fakeProjectPayload(),
    });
    return { app, sessionCookie, projectId: projRes.json().id };
  }

  it('records project creation audit', async () => {
    const { app, sessionCookie, projectId } = await authedUserWithProject();

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/audit`,
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const entries = res.json().entries;
    expect(entries.some((e: any) => e.action === 'project.create')).toBe(true);
  });

  it('records secret creation audit', async () => {
    const { app, sessionCookie, projectId } = await authedUserWithProject();

    await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/secrets`,
      cookies: { session: sessionCookie },
      payload: fakeSecretPayload(),
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/audit`,
      cookies: { session: sessionCookie },
    });
    const entries = res.json().entries;
    expect(entries.some((e: any) => e.action === 'secret.create')).toBe(true);
  });

  it('filters by action', async () => {
    const { app, sessionCookie, projectId } = await authedUserWithProject();

    await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/secrets`,
      cookies: { session: sessionCookie },
      payload: fakeSecretPayload(),
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/audit?action=project.create`,
      cookies: { session: sessionCookie },
    });
    const entries = res.json().entries;
    expect(entries.every((e: any) => e.action === 'project.create')).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('rejects audit access from non-owner', async () => {
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

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/audit`,
      cookies: { session: otherCookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
