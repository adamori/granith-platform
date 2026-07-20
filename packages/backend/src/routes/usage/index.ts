import type { FastifyInstance } from 'fastify';
import { getEffectiveLimits, getStorageUsed } from '../../services/limits.js';

const CONTACT = {
  email: 'adam@alibiro.com',
  telegram: 'https://t.me/paneelmaja',
} as const;

export async function usageRoutes(app: FastifyInstance) {
  const db = app.db;

  app.get('/usage', async (request, reply) => {
    const userId = request.user!.id;

    const [
      limits,
      usedBytes,
      overrideRow,
      projectCount,
      secretCount,
      tokenCount,
      notificationCount,
    ] = await Promise.all([
      getEffectiveLimits(db, userId),
      getStorageUsed(db, userId),
      db.selectFrom('users').where('id', '=', userId).select('limit_overrides').executeTakeFirst(),
      // Live object counts: exclude soft-deleted projects and their secrets.
      db
        .selectFrom('projects')
        .where('owner_id', '=', userId)
        .where('deleted_at', 'is', null)
        .select((eb) => eb.fn.countAll().as('n'))
        .executeTakeFirst(),
      db
        .selectFrom('secrets as s')
        .innerJoin('projects as p', 'p.id', 's.project_id')
        .where('s.owner_id', '=', userId)
        .where('s.deleted_at', 'is', null)
        .where('p.deleted_at', 'is', null)
        .select((eb) => eb.fn.countAll().as('n'))
        .executeTakeFirst(),
      db
        .selectFrom('tokens')
        .where('owner_id', '=', userId)
        .select((eb) => eb.fn.countAll().as('n'))
        .executeTakeFirst(),
      db
        .selectFrom('notification_services')
        .where('owner_id', '=', userId)
        .select((eb) => eb.fn.countAll().as('n'))
        .executeTakeFirst(),
    ]);

    const overrides = overrideRow?.limit_overrides ?? null;

    return reply.send({
      storage: {
        used_bytes: usedBytes,
        limit_bytes: limits.storage_bytes,
      },
      objects: {
        projects: Number(projectCount?.n ?? 0),
        secrets: Number(secretCount?.n ?? 0),
        tokens: Number(tokenCount?.n ?? 0),
        notification_services: Number(notificationCount?.n ?? 0),
      },
      override_active: overrides !== null && Object.keys(overrides).length > 0,
      contact: CONTACT,
    });
  });
}
