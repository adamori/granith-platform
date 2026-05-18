import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { projectIdParam } from '../../schemas/projects.js';
import { logAudit } from '../../services/audit.js';
import { NotFoundError } from '../../lib/errors.js';

export async function projectByIdRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;

  f.get('/:id', {
    schema: { params: projectIdParam },
  }, async (request, reply) => {
    const project = await db
      .selectFrom('projects')
      .where('id', '=', request.params.id)
      .where('owner_id', '=', request.user!.id)
      .where('deleted_at', 'is', null)
      .select(['id', 'name_ct', 'name_nonce', 'wrapped_pdk_for_user', 'wrap_nonce_for_user', 'created_at', 'updated_at'])
      .executeTakeFirst();

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    return reply.send({
      id: project.id,
      name_ct: (project.name_ct as Buffer).toString('base64'),
      name_nonce: (project.name_nonce as Buffer).toString('base64'),
      wrapped_pdk_for_user: (project.wrapped_pdk_for_user as Buffer).toString('base64'),
      wrap_nonce_for_user: (project.wrap_nonce_for_user as Buffer).toString('base64'),
      created_at: project.created_at,
      updated_at: project.updated_at,
    });
  });

  f.delete('/:id', {
    schema: { params: projectIdParam },
  }, async (request, reply) => {
    const result = await db
      .updateTable('projects')
      .set({ deleted_at: new Date() })
      .where('id', '=', request.params.id)
      .where('owner_id', '=', request.user!.id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      throw new NotFoundError('Project not found');
    }

    await logAudit(db, {
      actor_type: 'user',
      actor_id: request.user!.id,
      project_id: request.params.id,
      action: 'project.delete',
      resource_id: request.params.id,
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.status(204).send();
  });
}
