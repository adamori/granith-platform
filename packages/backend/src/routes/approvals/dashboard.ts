import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { paginationQuery, uuidParam } from '../../schemas/common.js';
import { NotFoundError, ConflictError } from '../../lib/errors.js';
import { logAudit } from '../../services/audit.js';

const listQuery = paginationQuery.extend({
  state: z.enum(['pending', 'approved', 'denied', 'expired', 'consumed']).optional(),
  project_id: z.string().uuid().optional(),
});

export async function approvalDashboardRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;

  f.get('/access-requests', {
    schema: { querystring: listQuery },
  }, async (request, reply) => {
    let query = db
      .selectFrom('access_requests')
      .where('owner_id', '=', request.user!.id)
      .select([
        'id', 'project_id', 'token_id', 'state', 'requester_ip', 'requester_user_agent',
        'created_at', 'expires_at', 'decided_at', 'decided_via', 'consumed_at',
      ])
      .orderBy('created_at', 'desc')
      .limit(request.query.limit)
      .offset(request.query.offset);

    if (request.query.state) {
      query = query.where('state', '=', request.query.state);
    }
    if (request.query.project_id) {
      query = query.where('project_id', '=', request.query.project_id);
    }

    const rows = await query.execute();
    return reply.send({
      requests: rows.map((r) => ({
        ...r,
        token_id: (r.token_id as Buffer).toString('hex'),
      })),
    });
  });

  for (const action of ['approve', 'deny'] as const) {
    f.post(`/access-requests/:id/${action}`, {
      schema: { params: uuidParam },
    }, async (request, reply) => {
      const owned = await db
        .selectFrom('access_requests')
        .where('id', '=', request.params.id)
        .where('owner_id', '=', request.user!.id)
        .select(['id', 'project_id'])
        .executeTakeFirst();
      if (!owned) throw new NotFoundError('Access request not found');

      const newState = action === 'approve' ? 'approved' : 'denied';
      const updated = await db
        .updateTable('access_requests')
        .set({ state: newState, decided_at: new Date(), decided_via: 'dashboard' })
        .where('id', '=', request.params.id)
        .where('state', '=', 'pending')
        .where('expires_at', '>', new Date())
        .executeTakeFirst();

      if (updated.numUpdatedRows !== 1n) {
        throw new ConflictError('Request already decided or expired');
      }

      await logAudit(db, {
        actor_type: 'user',
        actor_id: request.user!.id,
        project_id: owned.project_id,
        action: action === 'approve' ? 'access.approve' : 'access.deny',
        resource_id: owned.id,
        ip: request.ip,
        user_agent: request.headers['user-agent'],
        metadata: { via: 'dashboard' },
      });

      return reply.send({ id: owned.id, state: newState });
    });
  }
}
