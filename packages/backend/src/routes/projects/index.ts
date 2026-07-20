import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createProjectBody } from '../../schemas/projects.js';
import { logAudit } from '../../services/audit.js';
import { assertStorageAvailable, base64Bytes } from '../../services/limits.js';

export async function projectListRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;

  f.get('/', async (request, reply) => {
    const projects = await db
      .selectFrom('projects')
      .where('owner_id', '=', request.user!.id)
      .where('deleted_at', 'is', null)
      .select(['id', 'name_ct', 'name_nonce', 'wrapped_pdk_for_user', 'wrap_nonce_for_user', 'created_at', 'updated_at', 'require_approval'])
      .orderBy('created_at', 'desc')
      .execute();

    return reply.send({
      projects: projects.map((p) => ({
        id: p.id,
        name_ct: (p.name_ct as Buffer).toString('base64'),
        name_nonce: (p.name_nonce as Buffer).toString('base64'),
        wrapped_pdk_for_user: (p.wrapped_pdk_for_user as Buffer).toString('base64'),
        wrap_nonce_for_user: (p.wrap_nonce_for_user as Buffer).toString('base64'),
        created_at: p.created_at,
        updated_at: p.updated_at,
        require_approval: p.require_approval,
      })),
    });
  });

  f.post('/', {
    schema: { body: createProjectBody },
  }, async (request, reply) => {
    const { name_ct, name_nonce, wrapped_pdk_for_user, wrap_nonce_for_user } = request.body;

    const incomingBytes =
      base64Bytes(name_ct) + base64Bytes(name_nonce) +
      base64Bytes(wrapped_pdk_for_user) + base64Bytes(wrap_nonce_for_user);
    await assertStorageAvailable(db, request.user!.id, incomingBytes);

    const project = await db
      .insertInto('projects')
      .values({
        owner_id: request.user!.id,
        name_ct: Buffer.from(name_ct, 'base64'),
        name_nonce: Buffer.from(name_nonce, 'base64'),
        wrapped_pdk_for_user: Buffer.from(wrapped_pdk_for_user, 'base64'),
        wrap_nonce_for_user: Buffer.from(wrap_nonce_for_user, 'base64'),
      })
      .returning(['id', 'created_at'])
      .executeTakeFirstOrThrow();

    await logAudit(db, {
      actor_type: 'user',
      actor_id: request.user!.id,
      project_id: project.id,
      action: 'project.create',
      resource_id: project.id,
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.status(201).send({ id: project.id, created_at: project.created_at });
  });
}
