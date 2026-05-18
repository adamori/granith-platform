import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { UnauthorizedError } from '../lib/errors.js';

export function createAdminAuthHook(adminKey: string) {
  const adminKeyBuf = Buffer.from(adminKey, 'utf8');

  return async function verifyAdminKey(request: FastifyRequest, _reply: FastifyReply) {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing admin key');
    }
    const provided = Buffer.from(header.slice(7), 'utf8');
    if (provided.length !== adminKeyBuf.length || !timingSafeEqual(provided, adminKeyBuf)) {
      throw new UnauthorizedError('Invalid admin key');
    }
  };
}
