import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyDecisionToken } from '../../lib/approval-links.js';
import { logAudit } from '../../services/audit.js';

const decisionParams = z.object({
  rid: z.string().uuid(),
  action: z.string().max(16),
  exp: z.coerce.number().int(),
  t: z.string().min(1).max(128),
});

type DecisionParams = z.infer<typeof decisionParams>;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ));
}

function page(heading: string, inner: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Granith — ${esc(heading)}</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f1115; color: #e6e6e6; display: flex; justify-content: center; padding: 3rem 1rem; }
  main { max-width: 26rem; width: 100%; }
  h1 { font-size: 1.2rem; }
  dl { background: #1a1d24; border-radius: 8px; padding: 1rem; font-size: 0.9rem; }
  dt { color: #8a8f98; }
  dd { margin: 0 0 0.75rem; word-break: break-all; }
  button { font-size: 1rem; padding: 0.6rem 1.5rem; border: 0; border-radius: 6px; cursor: pointer; color: #fff; }
  .approve { background: #1f9d55; }
  .deny { background: #c53030; }
  p { color: #b3b8c2; }
</style>
</head>
<body><main><h1>${esc(heading)}</h1>${inner}</main></body>
</html>`;
}

function sendPage(reply: any, status: number, heading: string, inner: string) {
  return reply.status(status).type('text/html; charset=utf-8').send(page(heading, inner));
}

const INVALID = ['Invalid link', '<p>This approval link is invalid or has expired.</p>'] as const;

export async function approvalDecisionRoutes(app: FastifyInstance) {
  const db = app.db;

  // The confirmation page posts a plain HTML form; Fastify has no default parser for it.
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(String(body))));
  });

  const rateLimit = {
    max: 30,
    timeWindow: 60_000,
    keyGenerator: (request: any) => `approval:ip:${request.ip}`,
  };

  async function loadVerified(params: DecisionParams) {
    const row = await db
      .selectFrom('access_requests')
      .where('id', '=', params.rid)
      .select(['id', 'state', 'link_nonce', 'expires_at', 'requester_ip', 'requester_user_agent', 'created_at', 'project_id', 'owner_id'])
      .executeTakeFirst();
    if (!row) return null;
    if (!verifyDecisionToken(row.link_nonce as Buffer, params.action, params.exp, params.t)) return null;
    return row;
  }

  // Read-only: notification clients may prefetch this URL, so GET must never decide.
  app.get('/decision', {
    config: { rateLimit },
    schema: { querystring: decisionParams },
  }, async (request, reply) => {
    const params = request.query as DecisionParams;
    const row = await loadVerified(params);
    if (!row) return sendPage(reply, 404, ...INVALID);

    if (row.state !== 'pending' || row.expires_at <= new Date()) {
      const outcome = row.state === 'pending' ? 'expired' : row.state;
      return sendPage(reply, 200, 'Request already settled', `<p>This access request is <strong>${esc(outcome)}</strong>. No further action is possible.</p>`);
    }

    const verb = params.action === 'approve' ? 'Approve' : 'Deny';
    const inner = `
<p>A client is requesting the secrets bundle for one of your projects.</p>
<dl>
  <dt>Requester IP</dt><dd>${esc(row.requester_ip ?? 'unknown')}</dd>
  <dt>Client</dt><dd>${esc(row.requester_user_agent ?? 'unknown')}</dd>
  <dt>Requested</dt><dd>${esc(row.created_at.toISOString())}</dd>
  <dt>Auto-denies at</dt><dd>${esc(row.expires_at.toISOString())}</dd>
</dl>
<form method="POST" action="decision">
  <input type="hidden" name="rid" value="${esc(params.rid)}">
  <input type="hidden" name="action" value="${esc(params.action)}">
  <input type="hidden" name="exp" value="${params.exp}">
  <input type="hidden" name="t" value="${esc(params.t)}">
  <button type="submit" class="${params.action === 'approve' ? 'approve' : 'deny'}">${verb} this request</button>
</form>`;
    return sendPage(reply, 200, `${verb} bundle access?`, inner);
  });

  app.post('/decision', {
    config: { rateLimit },
    schema: { body: decisionParams },
  }, async (request, reply) => {
    const params = request.body as DecisionParams;
    const row = await loadVerified(params);
    if (!row) return sendPage(reply, 404, ...INVALID);

    const newState = params.action === 'approve' ? 'approved' : 'denied';
    const updated = await db
      .updateTable('access_requests')
      .set({ state: newState, decided_at: new Date(), decided_via: 'link' })
      .where('id', '=', params.rid)
      .where('state', '=', 'pending')
      .where('expires_at', '>', new Date())
      .executeTakeFirst();

    if (updated.numUpdatedRows !== 1n) {
      return sendPage(reply, 409, 'Request already settled', '<p>This access request was already decided or has expired.</p>');
    }

    await logAudit(db, {
      actor_type: 'user',
      actor_id: row.owner_id,
      project_id: row.project_id,
      action: params.action === 'approve' ? 'access.approve' : 'access.deny',
      resource_id: row.id,
      ip: request.ip,
      user_agent: request.headers['user-agent'],
      metadata: { via: 'link' },
    });

    return newState === 'approved'
      ? sendPage(reply, 200, 'Access approved', '<p>The requester will receive the bundle within a few seconds. This approval is valid for exactly one delivery.</p>')
      : sendPage(reply, 200, 'Access denied', '<p>The requester has been refused. No bundle was delivered.</p>');
  });
}
