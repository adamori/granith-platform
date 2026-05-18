import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { logAudit } from '../../services/audit.js';
import { NotFoundError } from '../../lib/errors.js';

const createInviteBody = z.object({
  ttl: z.string().default('7d'),
  count: z.number().int().min(1).max(50).default(1),
});

function parseTtl(ttl: string): number {
  const match = ttl.match(/^(\d+)([dhm])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1]!, 10);
  const unit = match[2];
  if (unit === 'd') return value * 24 * 60 * 60 * 1000;
  if (unit === 'h') return value * 60 * 60 * 1000;
  if (unit === 'm') return value * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

export async function inviteAdminRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;

  f.post('/invites', {
    schema: { body: createInviteBody },
  }, async (request, reply) => {
    const { ttl, count } = request.body;
    const expiresAt = new Date(Date.now() + parseTtl(ttl));
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      const code = randomBytes(16).toString('base64url');
      await db
        .insertInto('invite_codes')
        .values({
          code,
          created_by: null,
          expires_at: expiresAt,
        })
        .execute();
      codes.push(code);
    }

    await logAudit(db, {
      actor_type: 'user',
      actor_id: 'admin',
      action: 'invite.create',
      metadata: { count, ttl },
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.status(201).send({ codes, expires_at: expiresAt });
  });

  app.get('/invites', async (request, reply) => {
    const invites = await db
      .selectFrom('invite_codes')
      .selectAll()
      .orderBy('expires_at', 'desc')
      .execute();

    return reply.send({ invites });
  });

  app.delete('/invites/:code', async (request, reply) => {
    const { code } = request.params as { code: string };

    const result = await db
      .deleteFrom('invite_codes')
      .where('code', '=', code)
      .where('used_at', 'is', null)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      throw new NotFoundError('Invite code not found or already used');
    }

    await logAudit(db, {
      actor_type: 'user',
      actor_id: 'admin',
      action: 'invite.revoke',
      metadata: { code },
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.status(204).send();
  });
}
