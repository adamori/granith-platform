import type { FastifyReply, FastifyRequest } from 'fastify';
import { SESSION_TTL_DAYS } from './constants.js';

export const SESSION_COOKIE = 'session';

// Cookies are signed with SESSION_SECRET (see app.ts). Reading goes through
// unsignCookie so a tampered or unsigned value is rejected before any DB lookup.
export function readSessionId(request: FastifyRequest): string | null {
  const raw = request.cookies?.[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = request.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}

export function setSessionCookie(reply: FastifyReply, sessionId: string, isProduction: boolean): void {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    signed: true,
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(reply: FastifyReply, isProduction: boolean): void {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  });
}
