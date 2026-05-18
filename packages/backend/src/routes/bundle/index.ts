import type { FastifyInstance } from 'fastify';
import { hashTokenId } from '../../lib/crypto.js';
import { assembleBundle } from '../../services/bundle.js';
import { logAudit } from '../../services/audit.js';
import { UnauthorizedError, ForbiddenError, TooManyRequestsError } from '../../lib/errors.js';
import { RATE_LIMITS } from '../../lib/constants.js';

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

export async function bundleRoutes(app: FastifyInstance) {
  const db = app.db;

  async function authenticateToken(request: any) {
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
      .where('token_id', '=', tokenId)
      .select([
        'token_id', 'project_id', 'wrapped_pdk', 'wrap_nonce',
        'scopes', 'ip_allowlist', 'expires_at', 'revoked_at',
      ])
      .executeTakeFirst();

    if (!token) {
      throw new UnauthorizedError('Token not found');
    }

    if (token.revoked_at) {
      throw new UnauthorizedError('Token revoked');
    }

    if (new Date() > token.expires_at) {
      throw new UnauthorizedError('Token expired');
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

    // Update last_used_at async (fire-and-forget)
    db.updateTable('tokens')
      .set({ last_used_at: new Date() })
      .where('token_id', '=', tokenId)
      .execute()
      .catch(() => {});

    return token;
  }

  app.get('/bundle', {
    config: {
      rateLimit: {
        max: 600,
        timeWindow: 60_000,
        keyGenerator: (request: any) => `bundle:ip:${request.ip}`,
      },
    },
  }, async (request, reply) => {
    const token = await authenticateToken(request);
    checkTokenRateLimit((token.token_id as Buffer).toString('hex'));

    const { bundle, etag } = await assembleBundle(
      db,
      token.project_id,
      token.wrapped_pdk as Buffer,
      token.wrap_nonce as Buffer,
    );

    const ifNoneMatch = request.headers['if-none-match'];
    if (ifNoneMatch === `"${etag}"`) {
      return reply.status(304).send();
    }

    await logAudit(db, {
      actor_type: 'token',
      actor_id: (token.token_id as Buffer).toString('hex'),
      project_id: token.project_id,
      action: 'bundle.fetch',
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply
      .header('etag', `"${etag}"`)
      .header('cache-control', 'private, no-cache')
      .send(bundle);
  });

  // HEAD /v1/bundle is auto-handled by Fastify from the GET route
}
