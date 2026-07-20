import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp, truncateAll, getApp, getConfig } from '../helpers/setup.js';
import { registerClient } from '../helpers/opaque-client.js';
import { fakeProjectPayload, fakeSecretPayload, fakeTokenPayload } from '../helpers/fixtures.js';
import { buildApprovalUrls, decisionToken } from '../../src/lib/approval-links.js';
import { sweepExpireRequests } from '../../src/services/access/sweep.js';

describe('Approval-required bundle access', () => {
  beforeAll(async () => { await setupTestApp(); });
  afterAll(async () => { await teardownTestApp(); });
  beforeEach(async () => { await truncateAll(); });

  async function setupApprovalProject() {
    const app = getApp();
    const config = getConfig();
    const { sessionCookie } = await registerClient({
      handle: 'alice',
      password: 'pass',
      serverSetup: config.OPAQUE_SERVER_SETUP,
      app,
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

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${projectId}`,
      cookies: { session: sessionCookie },
      payload: { require_approval: true },
    });
    expect(patchRes.statusCode).toBe(200);

    return { app, rawToken, projectId, sessionCookie };
  }

  function fetchBundle(app: any, rawToken: string, requestId?: string) {
    return app.inject({
      method: 'GET',
      url: '/api/v1/bundle',
      headers: {
        authorization: `Bearer ${rawToken}`,
        ...(requestId ? { 'x-granith-approval-request': requestId } : {}),
      },
    });
  }

  async function getRequestRow(app: any, requestId: string) {
    return app.db
      .selectFrom('access_requests')
      .where('id', '=', requestId)
      .selectAll()
      .executeTakeFirstOrThrow();
  }

  async function decide(app: any, requestId: string, action: 'approve' | 'deny') {
    const row = await getRequestRow(app, requestId);
    const { approveUrl, denyUrl } = buildApprovalUrls(
      'http://localhost:3000', requestId, row.link_nonce, row.expires_at,
    );
    const url = (action === 'approve' ? approveUrl : denyUrl).replace('http://localhost:3000', '');
    const [path, qs] = url.split('?');
    return app.inject({
      method: 'POST',
      url: path,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: qs,
    });
  }

  it('returns 202 with a request id and creates a single pending request', async () => {
    const { app, rawToken } = await setupApprovalProject();

    const res = await fetchBundle(app, rawToken);
    expect(res.statusCode).toBe(202);
    const requestId = res.headers['x-granith-approval-request'] as string;
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['retry-after']).toBe('5');
    expect(res.json()).toMatchObject({ status: 'pending', request_id: requestId });

    // repeat fetch without header reuses the same active request
    const again = await fetchBundle(app, rawToken);
    expect(again.statusCode).toBe(202);
    expect(again.headers['x-granith-approval-request']).toBe(requestId);

    const count = await app.db.selectFrom('access_requests').select(app.db.fn.countAll().as('n')).executeTakeFirst();
    expect(Number(count!.n)).toBe(1);
  });

  it('polling with the request id stays 202 while pending', async () => {
    const { app, rawToken } = await setupApprovalProject();
    const first = await fetchBundle(app, rawToken);
    const requestId = first.headers['x-granith-approval-request'] as string;

    const poll = await fetchBundle(app, rawToken, requestId);
    expect(poll.statusCode).toBe(202);
    expect(poll.headers['x-granith-approval-request']).toBe(requestId);
  });

  it('approve link GET is read-only; POST approves; poll delivers exactly once', async () => {
    const { app, rawToken } = await setupApprovalProject();
    const first = await fetchBundle(app, rawToken);
    const requestId = first.headers['x-granith-approval-request'] as string;

    const row = await getRequestRow(app, requestId);
    const { approveUrl } = buildApprovalUrls('http://localhost:3000', requestId, row.link_nonce, row.expires_at);

    const getPage = await app.inject({ method: 'GET', url: approveUrl.replace('http://localhost:3000', '') });
    expect(getPage.statusCode).toBe(200);
    expect(getPage.headers['content-type']).toContain('text/html');
    expect(getPage.body).toContain('<form method="POST"');
    expect((await getRequestRow(app, requestId)).state).toBe('pending'); // GET did not mutate

    const post = await decide(app, requestId, 'approve');
    expect(post.statusCode).toBe(200);
    expect((await getRequestRow(app, requestId)).state).toBe('approved');

    const poll = await fetchBundle(app, rawToken, requestId);
    expect(poll.statusCode).toBe(200);
    expect(poll.json().secrets).toHaveLength(1);
    expect((await getRequestRow(app, requestId)).state).toBe('consumed');

    // one approval = one delivery
    const rePoll = await fetchBundle(app, rawToken, requestId);
    expect(rePoll.statusCode).toBe(409);
  });

  it('deny link results in 403 for the poller and decision is one-time', async () => {
    const { app, rawToken } = await setupApprovalProject();
    const first = await fetchBundle(app, rawToken);
    const requestId = first.headers['x-granith-approval-request'] as string;

    const post = await decide(app, requestId, 'deny');
    expect(post.statusCode).toBe(200);

    const poll = await fetchBundle(app, rawToken, requestId);
    expect(poll.statusCode).toBe(403);

    // second decision attempt (any action) hits the already-settled page
    const rePost = await decide(app, requestId, 'approve');
    expect(rePost.statusCode).toBe(409);
    expect((await getRequestRow(app, requestId)).state).toBe('denied');
  });

  it('rejects forged and expired decision tokens without leaking request details', async () => {
    const { app, rawToken } = await setupApprovalProject();
    const first = await fetchBundle(app, rawToken);
    const requestId = first.headers['x-granith-approval-request'] as string;
    const row = await getRequestRow(app, requestId);
    const exp = Math.floor(row.expires_at.getTime() / 1000);

    const forged = await app.inject({
      method: 'GET',
      url: `/api/approvals/decision?rid=${requestId}&action=approve&exp=${exp}&t=${'A'.repeat(43)}`,
    });
    expect(forged.statusCode).toBe(404);
    expect(forged.body).not.toContain('Requester IP');

    // deny token must not authorize approve
    const crossAction = await app.inject({
      method: 'POST',
      url: '/api/approvals/decision',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `rid=${requestId}&action=approve&exp=${exp}&t=${decisionToken(row.link_nonce, 'deny', exp)}`,
    });
    expect(crossAction.statusCode).toBe(404);

    // expired exp fails even with a matching token
    const staleExp = Math.floor(Date.now() / 1000) - 10;
    const stale = await app.inject({
      method: 'GET',
      url: `/api/approvals/decision?rid=${requestId}&action=approve&exp=${staleExp}&t=${decisionToken(row.link_nonce, 'approve', staleExp)}`,
    });
    expect(stale.statusCode).toBe(404);

    expect((await getRequestRow(app, requestId)).state).toBe('pending');
  });

  it('expires: stale pending request returns 410 on poll and via sweep', async () => {
    const { app, rawToken } = await setupApprovalProject();
    const first = await fetchBundle(app, rawToken);
    const requestId = first.headers['x-granith-approval-request'] as string;

    await app.db
      .updateTable('access_requests')
      .set({ expires_at: new Date(Date.now() - 1000) })
      .where('id', '=', requestId)
      .execute();

    const poll = await fetchBundle(app, rawToken, requestId);
    expect(poll.statusCode).toBe(410);
    expect((await getRequestRow(app, requestId)).state).toBe('expired');

    // a fresh fetch can start a new request now that the old one is terminal
    const fresh = await fetchBundle(app, rawToken);
    expect(fresh.statusCode).toBe(202);
    expect(fresh.headers['x-granith-approval-request']).not.toBe(requestId);

    // sweep expires stale rows too (covers abandoned requests no one polls)
    await app.db
      .updateTable('access_requests')
      .set({ expires_at: new Date(Date.now() - 1000) })
      .where('state', '=', 'pending')
      .execute();
    await sweepExpireRequests(app.db);
    const states = await app.db.selectFrom('access_requests').select(['state']).execute();
    expect(states.every((r: { state: string }) => r.state === 'expired')).toBe(true);
  });

  it('HEAD never creates an access request', async () => {
    const { app, rawToken } = await setupApprovalProject();

    const res = await app.inject({
      method: 'HEAD',
      url: '/api/v1/bundle',
      headers: { authorization: `Bearer ${rawToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['etag']).toBeDefined();

    const count = await app.db.selectFrom('access_requests').select(app.db.fn.countAll().as('n')).executeTakeFirst();
    expect(Number(count!.n)).toBe(0);
  });

  it('dashboard lists owner requests and approve/deny works once', async () => {
    const { app, rawToken, sessionCookie } = await setupApprovalProject();
    const first = await fetchBundle(app, rawToken);
    const requestId = first.headers['x-granith-approval-request'] as string;

    const list = await app.inject({
      method: 'GET',
      url: '/api/access-requests?state=pending',
      cookies: { session: sessionCookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().requests).toHaveLength(1);
    expect(list.json().requests[0].id).toBe(requestId);

    const approve = await app.inject({
      method: 'POST',
      url: `/api/access-requests/${requestId}/approve`,
      cookies: { session: sessionCookie },
    });
    expect(approve.statusCode).toBe(200);
    expect((await getRequestRow(app, requestId)).decided_via).toBe('dashboard');

    const again = await app.inject({
      method: 'POST',
      url: `/api/access-requests/${requestId}/deny`,
      cookies: { session: sessionCookie },
    });
    expect(again.statusCode).toBe(409);

    const poll = await fetchBundle(app, rawToken, requestId);
    expect(poll.statusCode).toBe(200);
  });

  it('dashboard endpoints are owner-scoped', async () => {
    const { app, rawToken } = await setupApprovalProject();
    const config = getConfig();
    const first = await fetchBundle(app, rawToken);
    const requestId = first.headers['x-granith-approval-request'] as string;

    const { sessionCookie: mallory } = await registerClient({
      handle: 'mallory',
      password: 'pass',
      serverSetup: config.OPAQUE_SERVER_SETUP,
      app,
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/access-requests',
      cookies: { session: mallory },
    });
    expect(list.json().requests).toHaveLength(0);

    const approve = await app.inject({
      method: 'POST',
      url: `/api/access-requests/${requestId}/approve`,
      cookies: { session: mallory },
    });
    expect(approve.statusCode).toBe(404);
    expect((await getRequestRow(app, requestId)).state).toBe('pending');
  });

  it('records the full audit trail', async () => {
    const { app, rawToken } = await setupApprovalProject();
    const first = await fetchBundle(app, rawToken);
    const requestId = first.headers['x-granith-approval-request'] as string;
    await decide(app, requestId, 'approve');
    await fetchBundle(app, rawToken, requestId);

    const actions = (await app.db.selectFrom('audit_log').select(['action']).execute())
      .map((r: { action: string }) => r.action);
    expect(actions).toContain('access.request');
    expect(actions).toContain('access.approve');
    expect(actions).toContain('bundle.fetch');
  });
});
