import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { loginStartBody, loginFinishBody } from '../../schemas/auth.js';
import * as opaqueService from '../../services/opaque.js';
import { createSession } from '../../services/session.js';
import { logAudit } from '../../services/audit.js';
import { BadRequestError, UnauthorizedError, TooManyRequestsError } from '../../lib/errors.js';
import { OPAQUE_LOGIN_STATE_TTL_SECONDS } from '../../lib/constants.js';

const loginHandleBuckets = new Map<string, { count: number; resetAt: number }>();

export async function loginRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;
  const config = app.config;

  f.post('/login/start', {
    schema: { body: loginStartBody },
    config: {
      rateLimit: {
        max: 20,
        timeWindow: 60_000,
        keyGenerator: (request: any) => `login:ip:${request.ip}`,
      },
    },
    preHandler: async (request: any) => {
      if (config.NODE_ENV === 'test') return;
      const handle = request.body?.handle;
      if (handle) {
        const key = `login:handle:${handle}`;
        const now = Date.now();
        const bucket = loginHandleBuckets.get(key);
        if (!bucket || now > bucket.resetAt) {
          loginHandleBuckets.set(key, { count: 1, resetAt: now + 60_000 });
        } else {
          bucket.count++;
          if (bucket.count > 5) {
            throw new TooManyRequestsError('Too many login attempts for this handle');
          }
        }
      }
    },
  }, async (request, reply) => {
    const { handle, startLoginRequest } = request.body;

    const user = await db
      .selectFrom('users')
      .where('handle', '=', handle)
      .select(['id', 'opaque_record'])
      .executeTakeFirst();

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const { serverLoginState, loginResponse } = opaqueService.startLogin({
      serverSetup: config.OPAQUE_SERVER_SETUP,
      userIdentifier: handle,
      registrationRecord: (user.opaque_record as Buffer).toString('base64url'),
      startLoginRequest,
    });

    const expiresAt = new Date(Date.now() + OPAQUE_LOGIN_STATE_TTL_SECONDS * 1000);
    const stateRow = await db
      .insertInto('opaque_login_state')
      .values({
        user_id: user.id,
        state: Buffer.from(serverLoginState, 'base64'),
        expires_at: expiresAt,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return reply.send({ loginResponse, login_id: stateRow.id });
  });

  f.post('/login/finish', {
    schema: { body: loginFinishBody },
  }, async (request, reply) => {
    const { login_id, finishLoginRequest } = request.body;

    const stateRow = await db
      .selectFrom('opaque_login_state')
      .where('id', '=', login_id)
      .where('expires_at', '>', new Date())
      .select(['state', 'user_id'])
      .executeTakeFirst();

    if (!stateRow) {
      throw new BadRequestError('Login session expired or invalid');
    }

    await db
      .deleteFrom('opaque_login_state')
      .where('id', '=', login_id)
      .execute();

    try {
      opaqueService.finishLogin({
        serverLoginState: (stateRow.state as Buffer).toString('base64url'),
        finishLoginRequest,
      });
    } catch {
      throw new UnauthorizedError('Invalid credentials');
    }

    const sessionId = await createSession(db, stateRow.user_id);

    await logAudit(db, {
      actor_type: 'user',
      actor_id: stateRow.user_id,
      action: 'login',
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    reply.setCookie('session', sessionId, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({ user_id: stateRow.user_id });
  });
}
