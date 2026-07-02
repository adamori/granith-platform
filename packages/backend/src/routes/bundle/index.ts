import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { sql } from 'kysely';
import { z } from 'zod';
import { hashTokenId } from '../../lib/crypto.js';
import type { AccessRequestState, TokenScopes } from '../../db/types.js';
import { assembleBundle } from '../../services/bundle.js';
import { logAudit } from '../../services/audit.js';
import { dispatchNotifications } from '../../services/notify/dispatch.js';
import { findOrCreateActiveRequest, consumeApprovedRequest, expirePendingRequest } from '../../services/access/requests.js';
import { buildApprovalUrls } from '../../lib/approval-links.js';
import {
  UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, GoneError, TooManyRequestsError,
} from '../../lib/errors.js';
import { RATE_LIMITS, APPROVAL_POLL_RETRY_AFTER_SECONDS } from '../../lib/constants.js';

function normalizeIp(ip: string): string {
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

const tokenBuckets = new Map<string, { count: number; resetAt: number }>();

function checkTokenRateLimit(tokenIdHex: string): void {
  const now = Date.now();
  const key = `tkn:${tokenIdHex}`;
  const bucket = tokenBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    tokenBuckets.set(key, { count: 1, resetAt: now + RATE_LIMITS.bundle.windowMs });
    return;
  }
  bucket.count++;
  if (bucket.count > RATE_LIMITS.bundle.perTokenId) {
    throw new TooManyRequestsError('Token rate limit exceeded');
  }
}

const bundleQuery = z.object({
  request_id: z.string().uuid().optional(),
});

interface AuthedToken {
  token_id: Buffer;
  project_id: string;
  owner_id: string;
  wrapped_pdk: Buffer;
  wrap_nonce: Buffer;
  require_approval: boolean;
}

export async function bundleRoutes(app: FastifyInstance) {
  const db = app.db;

  async function authenticateToken(request: any): Promise<AuthedToken> {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer grnth_')) {
      throw new UnauthorizedError('Invalid token format');
    }

    const raw = header.slice(7); // strip "Bearer "
    const parts = raw.slice(6).split('.'); // strip "grnth_" then split
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new UnauthorizedError('Invalid token format');
    }

    const lookupId = Buffer.from(parts[0]!, 'base64url');
    const tokenId = hashTokenId(lookupId);

    const token = await db
      .selectFrom('tokens')
      .innerJoin('projects', 'projects.id', 'tokens.project_id')
      .where('tokens.token_id', '=', tokenId)
      .select([
        'tokens.token_id', 'tokens.project_id', 'tokens.owner_id', 'tokens.wrapped_pdk',
        'tokens.wrap_nonce', 'tokens.scopes', 'tokens.ip_allowlist', 'tokens.expires_at',
        'tokens.revoked_at', 'projects.require_approval', 'projects.deleted_at as project_deleted_at',
      ])
      .executeTakeFirst();

    if (!token) {
      throw new UnauthorizedError('Token not found');
    }

    if (token.revoked_at) {
      throw new UnauthorizedError('Token revoked');
    }

    if (token.project_deleted_at) {
      throw new UnauthorizedError('Project deleted');
    }

    if (new Date() > token.expires_at) {
      throw new UnauthorizedError('Token expired');
    }

    const scopes = token.scopes as unknown as TokenScopes;
    if (!scopes?.read) {
      throw new ForbiddenError('Token lacks read scope');
    }

    if (token.ip_allowlist && token.ip_allowlist.length > 0) {
      const clientIp = normalizeIp(request.ip);
      const allowed = token.ip_allowlist.some(
        (ip: string) => normalizeIp(ip) === clientIp,
      );
      if (!allowed) {
        throw new ForbiddenError('IP not in allowlist');
      }
    }

    return {
      token_id: token.token_id as Buffer,
      project_id: token.project_id,
      owner_id: token.owner_id,
      wrapped_pdk: token.wrapped_pdk as Buffer,
      wrap_nonce: token.wrap_nonce as Buffer,
      require_approval: token.require_approval,
    };
  }

  // Fire-and-forget; only counts actual deliveries, not 202 polls or HEAD probes.
  function markTokenUsed(tokenId: Buffer): void {
    db.updateTable('tokens')
      .set({
        last_used_at: new Date(),
        usage_counter: sql<number>`coalesce(usage_counter, 0) + 1`,
      })
      .where('token_id', '=', tokenId)
      .execute()
      .catch(() => {});
  }

  async function deliverBundle(
    request: FastifyRequest,
    reply: FastifyReply,
    token: AuthedToken,
    accessRequestId?: string,
  ) {
    markTokenUsed(token.token_id);

    const { bundle, etag } = await assembleBundle(db, token.project_id, token.wrapped_pdk, token.wrap_nonce);

    const ifNoneMatch = request.headers['if-none-match'];
    if (ifNoneMatch === `"${etag}"`) {
      return reply.status(304).send();
    }

    await logAudit(db, {
      actor_type: 'token',
      actor_id: token.token_id.toString('hex'),
      project_id: token.project_id,
      action: 'bundle.fetch',
      ip: request.ip,
      user_agent: request.headers['user-agent'],
      metadata: accessRequestId ? { access_request: accessRequestId } : null,
    });

    // Fire notifications asynchronously — never block or fail the secrets delivery.
    dispatchNotifications(app, db, {
      projectId: token.project_id,
      ownerId: token.owner_id,
      trigger: 'bundle_pull',
      sourceKey: token.token_id.toString('hex'),
    }).catch((err) => app.log.error(err, 'notification dispatch failed'));

    return reply
      .header('etag', `"${etag}"`)
      .header('cache-control', 'private, no-cache')
      .send(bundle);
  }

  function sendPending(reply: FastifyReply, requestId: string, expiresAt: Date) {
    return reply
      .status(202)
      .header('x-granith-approval-request', requestId)
      .header('retry-after', String(APPROVAL_POLL_RETRY_AFTER_SECONDS))
      .send({ status: 'pending', request_id: requestId, expires_at: expiresAt.toISOString() });
  }

  function throwForState(state: AccessRequestState): never {
    if (state === 'denied') throw new ForbiddenError('Access denied by project owner');
    if (state === 'consumed') throw new ConflictError('Approval already used for a delivery');
    throw new GoneError('Approval request expired');
  }

  async function consumeAndDeliver(
    request: FastifyRequest,
    reply: FastifyReply,
    token: AuthedToken,
    requestId: string,
  ) {
    if (await consumeApprovedRequest(db, requestId)) {
      return deliverBundle(request, reply, token, requestId);
    }
    // lost the consume race — report the state the winner left behind
    const current = await db
      .selectFrom('access_requests')
      .where('id', '=', requestId)
      .select(['state'])
      .executeTakeFirst();
    if (!current) throw new NotFoundError('Approval request not found');
    throwForState(current.state);
  }

  async function handlePoll(
    request: FastifyRequest,
    reply: FastifyReply,
    token: AuthedToken,
    requestId: string,
  ) {
    const req = await db
      .selectFrom('access_requests')
      .where('id', '=', requestId)
      .where('token_id', '=', token.token_id)
      .select(['id', 'state', 'expires_at'])
      .executeTakeFirst();
    if (!req) throw new NotFoundError('Approval request not found');

    if (req.state === 'approved') {
      return consumeAndDeliver(request, reply, token, req.id);
    }

    if (req.state === 'pending') {
      // enforce the TTL exactly instead of waiting up to 60s for the sweep
      if (req.expires_at <= new Date()) {
        if (await expirePendingRequest(db, req.id)) {
          await logAudit(db, {
            actor_type: 'token',
            actor_id: token.token_id.toString('hex'),
            project_id: token.project_id,
            action: 'access.timeout',
            resource_id: req.id,
            metadata: { reason: 'timeout' },
          });
        }
        throw new GoneError('Approval request expired');
      }
      return sendPending(reply, req.id, req.expires_at);
    }

    throwForState(req.state);
  }

  app.get('/bundle', {
    config: {
      rateLimit: {
        max: 600,
        timeWindow: 60_000,
        keyGenerator: (request: any) => `bundle:ip:${request.ip}`,
      },
    },
    schema: { querystring: bundleQuery },
  }, async (request, reply) => {
    const token = await authenticateToken(request);
    checkTokenRateLimit(token.token_id.toString('hex'));

    // HEAD (granith ping) is a pure liveness probe: no approval gate, no request row,
    // no audit/notify. Fastify routes HEAD here automatically.
    if (request.method === 'HEAD') {
      const { etag } = await assembleBundle(db, token.project_id, token.wrapped_pdk, token.wrap_nonce);
      return reply
        .header('etag', `"${etag}"`)
        .header('cache-control', 'private, no-cache')
        .send();
    }

    if (!token.require_approval) {
      return deliverBundle(request, reply, token);
    }

    const headerId = request.headers['x-granith-approval-request'];
    const queryId = (request.query as z.infer<typeof bundleQuery>).request_id;
    const pollId = typeof headerId === 'string' && headerId !== '' ? headerId : queryId;

    if (pollId) {
      if (!z.string().uuid().safeParse(pollId).success) {
        throw new NotFoundError('Approval request not found');
      }
      return handlePoll(request, reply, token, pollId);
    }

    const active = await findOrCreateActiveRequest(db, token, {
      ip: normalizeIp(request.ip),
      userAgent: request.headers['user-agent'],
    });

    if (active.state === 'approved') {
      return consumeAndDeliver(request, reply, token, active.id);
    }

    if (active.created) {
      await logAudit(db, {
        actor_type: 'token',
        actor_id: token.token_id.toString('hex'),
        project_id: token.project_id,
        action: 'access.request',
        resource_id: active.id,
        ip: request.ip,
        user_agent: request.headers['user-agent'],
      });

      const { approveUrl, denyUrl } = buildApprovalUrls(
        app.config.PUBLIC_API_URL, active.id, active.link_nonce, active.expires_at,
      );
      dispatchNotifications(app, db, {
        projectId: token.project_id,
        ownerId: token.owner_id,
        trigger: 'approval_request',
        sourceKey: token.token_id.toString('hex'),
        data: {
          requestId: active.id,
          approveUrl,
          denyUrl,
          requesterIp: normalizeIp(request.ip),
          requesterUa: request.headers['user-agent'],
          expiresAt: active.expires_at,
        },
      }).catch((err) => app.log.error(err, 'notification dispatch failed'));
    }

    return sendPending(reply, active.id, active.expires_at);
  });
}
