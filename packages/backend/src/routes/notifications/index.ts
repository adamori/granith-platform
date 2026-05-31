import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createNotificationBody, deliveriesQuery } from '../../schemas/notifications.js';
import { logAudit } from '../../services/audit.js';
import { getDriver } from '../../services/notify/registry.js';
import { sealCredential } from '../../lib/notify-crypto.js';
import { NOTIFY_MAX_SERVICES_PER_USER } from '../../lib/constants.js';
import { BadRequestError, ConflictError } from '../../lib/errors.js';
import { assertOwnsProjects } from './ownership.js';

export async function notificationListRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;

  f.get('/notifications', async (request, reply) => {
    const userId = request.user!.id;

    const services = await db
      .selectFrom('notification_services')
      .where('owner_id', '=', userId)
      .select([
        'id', 'driver', 'label', 'watch_all_projects', 'triggers', 'throttle',
        'state', 'consecutive_client_errors', 'last_error', 'last_error_at',
        'last_sent_at', 'disabled_until', 'created_at',
      ])
      .orderBy('created_at', 'desc')
      .execute();

    const ids = services.map((s) => s.id);
    const watched = ids.length
      ? await db
          .selectFrom('notification_service_projects')
          .where('service_id', 'in', ids)
          .select(['service_id', 'project_id'])
          .execute()
      : [];

    const byService = new Map<string, string[]>();
    for (const row of watched) {
      const list = byService.get(row.service_id) ?? [];
      list.push(row.project_id);
      byService.set(row.service_id, list);
    }

    return reply.send({
      services: services.map((s) => ({
        ...s,
        project_ids: byService.get(s.id) ?? [],
      })),
    });
  });

  f.post('/notifications', {
    schema: { body: createNotificationBody },
  }, async (request, reply) => {
    const userId = request.user!.id;
    const body = request.body;

    const count = await db
      .selectFrom('notification_services')
      .where('owner_id', '=', userId)
      .select((eb) => eb.fn.countAll().as('n'))
      .executeTakeFirst();
    if (Number(count?.n ?? 0) >= NOTIFY_MAX_SERVICES_PER_USER) {
      throw new ConflictError(`Limit of ${NOTIFY_MAX_SERVICES_PER_USER} notification services reached`);
    }

    const driver = getDriver(body.driver);
    if (!driver) throw new BadRequestError('Unknown driver');
    const validation = driver.validateCredential(body.credential);
    if (!validation.ok) throw new BadRequestError(validation.error);

    const projectIds = body.watch_all_projects ? [] : body.project_ids;
    if (!body.watch_all_projects && projectIds.length === 0) {
      throw new BadRequestError('Select at least one project to watch, or enable all projects');
    }
    await assertOwnsProjects(db, projectIds, userId);

    const sealed = sealCredential(JSON.stringify(validation.normalized), app.config.NOTIFY_ENCRYPTION_KEY);

    const id = await db.transaction().execute(async (trx) => {
      const inserted = await trx
        .insertInto('notification_services')
        .values({
          owner_id: userId,
          driver: body.driver,
          label: body.label ?? null,
          credential_ct: sealed.ct,
          credential_nonce: sealed.nonce,
          watch_all_projects: body.watch_all_projects,
          triggers: JSON.stringify(body.triggers) as any,
          throttle: JSON.stringify(body.throttle) as any,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      if (projectIds.length > 0) {
        await trx
          .insertInto('notification_service_projects')
          .values(projectIds.map((project_id) => ({ service_id: inserted.id, project_id })))
          .execute();
      }
      return inserted.id;
    });

    await logAudit(db, {
      actor_type: 'user',
      actor_id: userId,
      action: 'notification.create',
      resource_id: id,
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.status(201).send({ id });
  });

  f.get('/notifications/deliveries', {
    schema: { querystring: deliveriesQuery },
  }, async (request, reply) => {
    const userId = request.user!.id;

    let query = db
      .selectFrom('notification_deliveries as d')
      .innerJoin('notification_services as s', 's.id', 'd.service_id')
      .where('s.owner_id', '=', userId)
      .select(['d.id', 'd.service_id', 'd.project_id', 'd.trigger_type', 'd.status', 'd.error_message', 'd.created_at'])
      .orderBy('d.created_at', 'desc')
      .limit(request.query.limit)
      .offset(request.query.offset);

    if (request.query.service_id) {
      query = query.where('d.service_id', '=', request.query.service_id);
    }

    const entries = await query.execute();
    return reply.send({ entries });
  });
}
