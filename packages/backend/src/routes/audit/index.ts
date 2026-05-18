import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { projectIdParam } from '../../schemas/projects.js';
import { paginationQuery } from '../../schemas/common.js';
import { NotFoundError } from '../../lib/errors.js';
import { z } from 'zod';

const auditQuery = paginationQuery.extend({
  action: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function auditRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;

  f.get('/:id/audit', {
    schema: { params: projectIdParam, querystring: auditQuery },
  }, async (request, reply) => {
    const project = await db
      .selectFrom('projects')
      .where('id', '=', request.params.id)
      .where('owner_id', '=', request.user!.id)
      .where('deleted_at', 'is', null)
      .select('id')
      .executeTakeFirst();

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    let query = db
      .selectFrom('audit_log')
      .where('project_id', '=', request.params.id)
      .select(['id', 'actor_type', 'actor_id', 'action', 'resource_id', 'ip', 'user_agent', 'metadata', 'ts'])
      .orderBy('ts', 'desc')
      .limit(request.query.limit)
      .offset(request.query.offset);

    if (request.query.action) {
      query = query.where('action', '=', request.query.action);
    }
    if (request.query.from) {
      query = query.where('ts', '>=', new Date(request.query.from));
    }
    if (request.query.to) {
      query = query.where('ts', '<=', new Date(request.query.to));
    }

    const entries = await query.execute();

    return reply.send({ entries });
  });
}
