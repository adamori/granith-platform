import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { updateSecretBody, secretIdParam } from '../../schemas/secrets.js';
import { logAudit } from '../../services/audit.js';
import { NotFoundError } from '../../lib/errors.js';

export async function secretByIdRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;

  f.put('/:id/secrets/:sid', {
    schema: { params: secretIdParam, body: updateSecretBody },
  }, async (request, reply) => {
    const { id: projectId, sid } = request.params;
    const { wrapped_item_key, wik_nonce, name_ct, name_nonce, value_ct, value_nonce } = request.body;

    const result = await db
      .updateTable('secrets')
      .set({
        wrapped_item_key: Buffer.from(wrapped_item_key, 'base64'),
        wik_nonce: Buffer.from(wik_nonce, 'base64'),
        name_ct: Buffer.from(name_ct, 'base64'),
        name_nonce: Buffer.from(name_nonce, 'base64'),
        value_ct: Buffer.from(value_ct, 'base64'),
        value_nonce: Buffer.from(value_nonce, 'base64'),
        updated_at: new Date(),
        version: (eb: any) => eb('version', '+', 1),
      } as any)
      .where('id', '=', sid)
      .where('project_id', '=', projectId)
      .where('owner_id', '=', request.user!.id)
      .where('deleted_at', 'is', null)
      .returning(['id', 'version', 'updated_at'])
      .executeTakeFirst();

    if (!result) {
      throw new NotFoundError('Secret not found');
    }

    await logAudit(db, {
      actor_type: 'user',
      actor_id: request.user!.id,
      project_id: projectId,
      action: 'secret.update',
      resource_id: sid,
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.send({ id: result.id, version: result.version, updated_at: result.updated_at });
  });

  f.delete('/:id/secrets/:sid', {
    schema: { params: secretIdParam },
  }, async (request, reply) => {
    const { id: projectId, sid } = request.params;

    const result = await db
      .updateTable('secrets')
      .set({ deleted_at: new Date() })
      .where('id', '=', sid)
      .where('project_id', '=', projectId)
      .where('owner_id', '=', request.user!.id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      throw new NotFoundError('Secret not found');
    }

    await logAudit(db, {
      actor_type: 'user',
      actor_id: request.user!.id,
      project_id: projectId,
      action: 'secret.delete',
      resource_id: sid,
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.status(204).send();
  });
}
