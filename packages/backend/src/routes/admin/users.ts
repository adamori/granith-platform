import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { logAudit } from '../../services/audit.js';
import { NotFoundError } from '../../lib/errors.js';
import { getEffectiveLimits, getStorageUsed } from '../../services/limits.js';

const handleParam = z.object({ handle: z.string() });

const putLimitsBody = z.object({
  // A number sets the storage override; null clears it (back to defaults).
  storage_bytes: z.number().int().nonnegative().nullable(),
});

export async function userAdminRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;

  app.get('/users', async (_request, reply) => {
    const users = await db
      .selectFrom('users')
      .select(['id', 'handle', 'created_at', 'updated_at'])
      .orderBy('created_at', 'desc')
      .execute();

    return reply.send({ users });
  });

  app.delete('/users/:handle', async (request, reply) => {
    const { handle } = request.params as { handle: string };

    const user = await db
      .selectFrom('users')
      .where('handle', '=', handle)
      .select('id')
      .executeTakeFirst();

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await db.deleteFrom('users').where('id', '=', user.id).execute();

    await logAudit(db, {
      actor_type: 'user',
      actor_id: 'admin',
      action: 'user.delete',
      metadata: { handle },
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.status(204).send();
  });

  f.get('/users/:handle/limits', {
    schema: { params: handleParam },
  }, async (request, reply) => {
    const { handle } = request.params;

    const user = await db
      .selectFrom('users')
      .where('handle', '=', handle)
      .select(['id', 'limit_overrides'])
      .executeTakeFirst();

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const [effective, usedBytes] = await Promise.all([
      getEffectiveLimits(db, user.id),
      getStorageUsed(db, user.id),
    ]);

    return reply.send({
      handle,
      limit_overrides: user.limit_overrides ?? null,
      effective: { storage_bytes: effective.storage_bytes },
      used_bytes: usedBytes,
    });
  });

  f.put('/users/:handle/limits', {
    schema: { params: handleParam, body: putLimitsBody },
  }, async (request, reply) => {
    const { handle } = request.params;
    const { storage_bytes } = request.body;

    const user = await db
      .selectFrom('users')
      .where('handle', '=', handle)
      .select('id')
      .executeTakeFirst();

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const limitOverrides = storage_bytes === null ? null : JSON.stringify({ storage_bytes });

    await db
      .updateTable('users')
      .set({ limit_overrides: limitOverrides, updated_at: new Date().toISOString() })
      .where('id', '=', user.id)
      .execute();

    await logAudit(db, {
      actor_type: 'user',
      actor_id: 'admin',
      action: 'limits.override',
      resource_id: user.id,
      metadata: { handle, storage_bytes },
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    const effective = await getEffectiveLimits(db, user.id);

    return reply.send({
      handle,
      limit_overrides: storage_bytes === null ? null : { storage_bytes },
      effective: { storage_bytes: effective.storage_bytes },
    });
  });
}
