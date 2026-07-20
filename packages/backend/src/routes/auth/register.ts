import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { registerStartBody, registerFinishBody } from '../../schemas/auth.js';
import * as opaqueService from '../../services/opaque.js';
import { createSession } from '../../services/session.js';
import { logAudit } from '../../services/audit.js';
import { setSessionCookie } from '../../lib/session-cookie.js';
import { AppError, ConflictError, ForbiddenError } from '../../lib/errors.js';

export async function registerRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;
  const config = app.config;

  f.post('/register/start', {
    schema: { body: registerStartBody },
    config: {
      rateLimit: { max: 5, timeWindow: 60_000 },
    },
  }, async (request, reply) => {
    if (config.REGISTRATION_MODE === 'closed') {
      throw new ForbiddenError('Registration is temporarily closed');
    }

    const { handle, registrationRequest } = request.body;

    const existing = await db
      .selectFrom('users')
      .where('handle', '=', handle)
      .select('id')
      .executeTakeFirst();

    if (existing) {
      throw new ConflictError('Handle already taken');
    }

    const { registrationResponse } = opaqueService.createRegistrationResponse({
      serverSetup: config.OPAQUE_SERVER_SETUP,
      userIdentifier: handle,
      registrationRequest,
    });

    return reply.send({ registrationResponse });
  });

  f.post('/register/finish', {
    schema: { body: registerFinishBody },
    config: {
      rateLimit: { max: 10, timeWindow: 86_400_000 },
    },
  }, async (request, reply) => {
    if (config.REGISTRATION_MODE === 'closed') {
      throw new ForbiddenError('Registration is temporarily closed');
    }

    const { handle, registrationRecord, kdf_params } = request.body;

    let user: { id: string; handle: string };
    try {
      user = await db.transaction().execute(async (tx) => {
        const newUser = await tx
          .insertInto('users')
          .values({
            handle,
            kdf_params: JSON.stringify(kdf_params) as any,
            opaque_record: Buffer.from(registrationRecord, 'base64'),
            invite_code_used: null,
          })
          .returning(['id', 'handle'])
          .executeTakeFirstOrThrow();

        return newUser;
      });
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      if (err.code === '23505' && err.constraint?.includes('handle')) {
        throw new ConflictError('Handle already taken');
      }
      throw err;
    }

    const sessionId = await createSession(db, user.id);

    await logAudit(db, {
      actor_type: 'user',
      actor_id: user.id,
      action: 'register',
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    setSessionCookie(reply, sessionId, config.NODE_ENV === 'production');

    return reply.status(201).send({ user_id: user.id });
  });
}
