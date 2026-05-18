import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createSecretBody } from '../../schemas/secrets.js';
import { projectIdParam } from '../../schemas/projects.js';
import { logAudit } from '../../services/audit.js';
import { NotFoundError } from '../../lib/errors.js';

export async function secretListRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;

  f.get('/:id/secrets', {
    schema: { params: projectIdParam },
  }, async (request, reply) => {
    await verifyProjectOwnership(db, request.params.id, request.user!.id);

    const secrets = await db
      .selectFrom('secrets')
      .where('project_id', '=', request.params.id)
      .where('deleted_at', 'is', null)
      .select([
        'id', 'wrapped_item_key', 'wik_nonce',
        'name_ct', 'name_nonce', 'value_ct', 'value_nonce',
        'version', 'created_at', 'updated_at',
      ])
      .orderBy('updated_at', 'desc')
      .execute();

    return reply.send({
      secrets: secrets.map((s) => ({
        id: s.id,
        wrapped_item_key: (s.wrapped_item_key as Buffer).toString('base64'),
        wik_nonce: (s.wik_nonce as Buffer).toString('base64'),
        name_ct: (s.name_ct as Buffer).toString('base64'),
        name_nonce: (s.name_nonce as Buffer).toString('base64'),
        value_ct: (s.value_ct as Buffer).toString('base64'),
        value_nonce: (s.value_nonce as Buffer).toString('base64'),
        version: s.version,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
    });
  });

  f.post('/:id/secrets', {
    schema: { params: projectIdParam, body: createSecretBody },
  }, async (request, reply) => {
    await verifyProjectOwnership(db, request.params.id, request.user!.id);

    const { wrapped_item_key, wik_nonce, name_ct, name_nonce, value_ct, value_nonce } = request.body;

    const secret = await db
      .insertInto('secrets')
      .values({
        project_id: request.params.id,
        owner_id: request.user!.id,
        wrapped_item_key: Buffer.from(wrapped_item_key, 'base64'),
        wik_nonce: Buffer.from(wik_nonce, 'base64'),
        name_ct: Buffer.from(name_ct, 'base64'),
        name_nonce: Buffer.from(name_nonce, 'base64'),
        value_ct: Buffer.from(value_ct, 'base64'),
        value_nonce: Buffer.from(value_nonce, 'base64'),
      })
      .returning(['id', 'version', 'created_at'])
      .executeTakeFirstOrThrow();

    await logAudit(db, {
      actor_type: 'user',
      actor_id: request.user!.id,
      project_id: request.params.id,
      action: 'secret.create',
      resource_id: secret.id,
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.status(201).send({ id: secret.id, version: secret.version, created_at: secret.created_at });
  });
}

async function verifyProjectOwnership(db: any, projectId: string, userId: string) {
  const project = await db
    .selectFrom('projects')
    .where('id', '=', projectId)
    .where('owner_id', '=', userId)
    .where('deleted_at', 'is', null)
    .select('id')
    .executeTakeFirst();

  if (!project) {
    throw new NotFoundError('Project not found');
  }
}
