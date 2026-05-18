import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import * as opaqueService from '../../services/opaque.js';
import { logAudit } from '../../services/audit.js';
import { deleteAllSessionsExcept } from '../../services/session.js';

const changePasswordStartBody = z.object({
  registrationRequest: z.string(),
});

const changePasswordFinishBody = z.object({
  registrationRecord: z.string(),
  kdf_params: z.object({
    algorithm: z.string(),
    time_cost: z.number().int().positive(),
    memory_cost: z.number().int().positive(),
    parallelism: z.number().int().positive(),
    salt_length: z.number().int().positive(),
  }),
  rewrapped_pdks: z.array(z.object({
    project_id: z.string().uuid(),
    wrapped_pdk_for_user: z.string(),
    wrap_nonce_for_user: z.string(),
  })),
});

export async function passwordRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;
  const config = app.config;

  f.post('/password/start', {
    schema: { body: changePasswordStartBody },
  }, async (request, reply) => {
    const user = request.user!;

    const { registrationResponse } = opaqueService.createRegistrationResponse({
      serverSetup: config.OPAQUE_SERVER_SETUP,
      userIdentifier: user.handle,
      registrationRequest: request.body.registrationRequest,
    });

    return reply.send({ registrationResponse });
  });

  f.post('/password/finish', {
    schema: { body: changePasswordFinishBody },
  }, async (request, reply) => {
    const user = request.user!;
    const { registrationRecord, kdf_params, rewrapped_pdks } = request.body;

    await db.transaction().execute(async (tx) => {
      await tx
        .updateTable('users')
        .set({
          opaque_record: Buffer.from(registrationRecord, 'base64'),
          kdf_params: JSON.stringify(kdf_params) as any,
          updated_at: new Date().toISOString(),
        })
        .where('id', '=', user.id)
        .execute();

      for (const pdk of rewrapped_pdks) {
        await tx
          .updateTable('projects')
          .set({
            wrapped_pdk_for_user: Buffer.from(pdk.wrapped_pdk_for_user, 'base64'),
            wrap_nonce_for_user: Buffer.from(pdk.wrap_nonce_for_user, 'base64'),
            updated_at: new Date().toISOString(),
          })
          .where('id', '=', pdk.project_id)
          .where('owner_id', '=', user.id)
          .execute();
      }
    });

    const currentSessionId = request.cookies?.['session'];
    await deleteAllSessionsExcept(db, user.id, currentSessionId);

    await logAudit(db, {
      actor_type: 'user',
      actor_id: user.id,
      action: 'password.change',
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.send({ ok: true });
  });
}
