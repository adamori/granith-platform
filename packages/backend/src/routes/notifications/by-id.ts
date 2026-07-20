import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { sql } from 'kysely';
import { notifyIdParam, patchNotificationBody } from '../../schemas/notifications.js';
import { logAudit } from '../../services/audit.js';
import { getDriver } from '../../services/notify/registry.js';
import { sealCredential } from '../../lib/notify-crypto.js';
import { assertStorageAvailable } from '../../services/limits.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { assertOwnsProjects } from './ownership.js';

export async function notificationByIdRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;

  f.patch('/notifications/:nid', {
    schema: { params: notifyIdParam, body: patchNotificationBody },
  }, async (request, reply) => {
    const userId = request.user!.id;
    const nid = request.params.nid;
    const body = request.body;

    const service = await db
      .selectFrom('notification_services')
      .where('id', '=', nid)
      .where('owner_id', '=', userId)
      .select([
        'id', 'driver', 'watch_all_projects',
        sql<number>`octet_length(credential_ct) + octet_length(credential_nonce)`.as('credential_bytes'),
      ])
      .executeTakeFirst();
    if (!service) throw new NotFoundError('Notification service not found');

    const updates: Record<string, any> = { updated_at: new Date() };

    if (body.label !== undefined) updates.label = body.label;
    if (body.triggers !== undefined) updates.triggers = JSON.stringify(body.triggers);
    if (body.throttle !== undefined) updates.throttle = JSON.stringify(body.throttle);

    if (body.credential !== undefined) {
      const driver = getDriver(service.driver);
      if (!driver) throw new BadRequestError('Unknown driver');
      const validation = driver.validateCredential(body.credential);
      if (!validation.ok) throw new BadRequestError(validation.error);
      const sealed = sealCredential(JSON.stringify(validation.normalized), app.config.NOTIFY_ENCRYPTION_KEY);
      await assertStorageAvailable(db, userId, sealed.ct.length + sealed.nonce.length - Number(service.credential_bytes));
      updates.credential_ct = sealed.ct;
      updates.credential_nonce = sealed.nonce;
    }

    // Manual re-enable: reset the failure state machine to a clean slate.
    if (body.state === 'enabled') {
      updates.state = 'enabled';
      updates.consecutive_client_errors = 0;
      updates.disabled_at = null;
      updates.disabled_until = null;
      updates.last_error = null;
      updates.last_error_at = null;
    }

    // Watch scope changes.
    const touchWatch = body.watch_all_projects !== undefined || body.project_ids !== undefined;
    let newWatchAll = service.watch_all_projects;
    if (body.watch_all_projects !== undefined) newWatchAll = body.watch_all_projects;
    let newProjectIds: string[] | null = null;
    if (body.project_ids !== undefined) {
      newProjectIds = body.project_ids;
      if (body.watch_all_projects === undefined) newWatchAll = false;
    }
    if (newWatchAll) newProjectIds = [];
    if (!newWatchAll && newProjectIds !== null && newProjectIds.length === 0) {
      throw new BadRequestError('Select at least one project to watch, or enable all projects');
    }
    if (touchWatch) {
      updates.watch_all_projects = newWatchAll;
      if (newProjectIds && newProjectIds.length > 0) {
        await assertOwnsProjects(db, newProjectIds, userId);
      }
    }

    await db.transaction().execute(async (trx) => {
      await trx.updateTable('notification_services').set(updates).where('id', '=', nid).execute();
      if (touchWatch && newProjectIds !== null) {
        await trx.deleteFrom('notification_service_projects').where('service_id', '=', nid).execute();
        if (newProjectIds.length > 0) {
          await trx
            .insertInto('notification_service_projects')
            .values(newProjectIds.map((project_id) => ({ service_id: nid, project_id })))
            .execute();
        }
      }
    });

    await logAudit(db, {
      actor_type: 'user',
      actor_id: userId,
      action: 'notification.update',
      resource_id: nid,
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.send({ ok: true });
  });

  f.delete('/notifications/:nid', {
    schema: { params: notifyIdParam },
  }, async (request, reply) => {
    const userId = request.user!.id;
    const nid = request.params.nid;

    const result = await db
      .deleteFrom('notification_services')
      .where('id', '=', nid)
      .where('owner_id', '=', userId)
      .returning('id')
      .executeTakeFirst();
    if (!result) throw new NotFoundError('Notification service not found');

    await logAudit(db, {
      actor_type: 'user',
      actor_id: userId,
      action: 'notification.delete',
      resource_id: nid,
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.status(204).send();
  });
}
