import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp, truncateAll, getApp, getConfig } from '../helpers/setup.js';
import { registerClient } from '../helpers/opaque-client.js';
import { fakeProjectPayload, fakeSecretPayload } from '../helpers/fixtures.js';

const adminHeaders = { authorization: `Bearer test-admin-key-that-is-at-least-32-chars-long!` };

function b64len(s: string): number {
  return Buffer.from(s, 'base64').length;
}
function projectBytes(p: ReturnType<typeof fakeProjectPayload>): number {
  return b64len(p.name_ct) + b64len(p.name_nonce) + b64len(p.wrapped_pdk_for_user) + b64len(p.wrap_nonce_for_user);
}
function secretBytes(s: ReturnType<typeof fakeSecretPayload>): number {
  return (
    b64len(s.wrapped_item_key) + b64len(s.wik_nonce) +
    b64len(s.name_ct) + b64len(s.name_nonce) +
    b64len(s.value_ct) + b64len(s.value_nonce)
  );
}

describe('Usage & storage limits', () => {
  beforeAll(async () => { await setupTestApp(); });
  afterAll(async () => { await teardownTestApp(); });
  beforeEach(async () => { await truncateAll(); });

  async function authedUser(handle = 'alice') {
    const config = getConfig();
    return registerClient({
      handle,
      password: 'pass',
      serverSetup: config.OPAQUE_SERVER_SETUP,
      app: getApp(),
    });
  }

  it('GET /api/usage returns correct sums after a project + secrets', async () => {
    const app = getApp();
    const { sessionCookie } = await authedUser();

    const projectPayload = fakeProjectPayload();
    const projRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { session: sessionCookie },
      payload: projectPayload,
    });
    const projectId = projRes.json().id;

    const secret1 = fakeSecretPayload();
    const secret2 = fakeSecretPayload();
    for (const payload of [secret1, secret2]) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/secrets`,
        cookies: { session: sessionCookie },
        payload,
      });
      expect(res.statusCode).toBe(201);
    }

    const expectedBytes = projectBytes(projectPayload) + secretBytes(secret1) + secretBytes(secret2);

    const usageRes = await app.inject({
      method: 'GET',
      url: '/api/usage',
      cookies: { session: sessionCookie },
    });
    expect(usageRes.statusCode).toBe(200);
    const body = usageRes.json();

    expect(body.storage.used_bytes).toBe(expectedBytes);
    expect(body.storage.limit_bytes).toBe(1048576);
    expect(body.objects).toEqual({
      projects: 1,
      secrets: 2,
      tokens: 0,
      notification_services: 0,
    });
    expect(body.override_active).toBe(false);
    expect(body.contact).toEqual({ email: 'adam@alibiro.com', telegram: 'https://t.me/paneelmaja' });
  });

  it('soft-deleted projects/secrets still count in storage but not in object counts', async () => {
    const app = getApp();
    const { sessionCookie } = await authedUser();

    const projectPayload = fakeProjectPayload();
    const projRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { session: sessionCookie },
      payload: projectPayload,
    });
    const projectId = projRes.json().id;

    const secretPayload = fakeSecretPayload();
    const secRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/secrets`,
      cookies: { session: sessionCookie },
      payload: secretPayload,
    });
    const sid = secRes.json().id;

    await app.inject({
      method: 'DELETE',
      url: `/api/projects/${projectId}/secrets/${sid}`,
      cookies: { session: sessionCookie },
    });

    const usageRes = await app.inject({ method: 'GET', url: '/api/usage', cookies: { session: sessionCookie } });
    const body = usageRes.json();
    // Storage still counts the soft-deleted secret's bytes.
    expect(body.storage.used_bytes).toBe(projectBytes(projectPayload) + secretBytes(secretPayload));
    // But object counts exclude it.
    expect(body.objects.secrets).toBe(0);
    expect(body.objects.projects).toBe(1);
  });

  it('enforces storage limit: secret create fails with LIMIT_EXCEEDED, clearing override restores', async () => {
    const app = getApp();
    const { sessionCookie } = await authedUser();

    const projRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { session: sessionCookie },
      payload: fakeProjectPayload(),
    });
    const projectId = projRes.json().id;

    // Tiny override so a couple of secrets tip over the limit.
    const setRes = await app.inject({
      method: 'PUT',
      url: '/api/admin/users/alice/limits',
      headers: adminHeaders,
      payload: { storage_bytes: 500 },
    });
    expect(setRes.statusCode).toBe(200);

    // First secret fits (project 112 + secret 200 = 312 <= 500).
    const ok1 = await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/secrets`,
      cookies: { session: sessionCookie },
      payload: fakeSecretPayload(),
    });
    expect(ok1.statusCode).toBe(201);

    // Second secret pushes over (312 + 200 = 512 > 500).
    const blocked = await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/secrets`,
      cookies: { session: sessionCookie },
      payload: fakeSecretPayload(),
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error).toBe('LIMIT_EXCEEDED');

    // Clearing the override lifts the limit back to the 1 MB default.
    const clearRes = await app.inject({
      method: 'PUT',
      url: '/api/admin/users/alice/limits',
      headers: adminHeaders,
      payload: { storage_bytes: null },
    });
    expect(clearRes.statusCode).toBe(200);

    const ok2 = await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/secrets`,
      cookies: { session: sessionCookie },
      payload: fakeSecretPayload(),
    });
    expect(ok2.statusCode).toBe(201);
  });
});
