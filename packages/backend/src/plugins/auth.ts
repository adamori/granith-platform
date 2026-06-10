import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../lib/errors.js';
import { readSessionId } from '../lib/session-cookie.js';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types.js';

export interface AuthUser {
  id: string;
  handle: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export function createSessionAuthHook(db: Kysely<Database>) {
  return async function verifySession(request: FastifyRequest, _reply: FastifyReply) {
    const sessionId = readSessionId(request);
    if (!sessionId) {
      throw new UnauthorizedError('No session');
    }

    const session = await db
      .selectFrom('sessions')
      .innerJoin('users', 'users.id', 'sessions.user_id')
      .where('sessions.id', '=', sessionId)
      .where('sessions.expires_at', '>', new Date())
      .select(['users.id', 'users.handle'])
      .executeTakeFirst();

    if (!session) {
      throw new UnauthorizedError('Invalid or expired session');
    }

    request.user = { id: session.id, handle: session.handle };
  };
}
