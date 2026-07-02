import { createHash, timingSafeEqual } from 'node:crypto';

export type DecisionAction = 'approve' | 'deny';

// Root of trust is the per-request link_nonce (server-side only) — no global secret.
export function decisionToken(linkNonce: Buffer, action: DecisionAction, exp: number): string {
  return createHash('sha256').update(linkNonce).update(`:${action}:${exp}`).digest('base64url');
}

export function verifyDecisionToken(
  linkNonce: Buffer,
  action: string,
  exp: number,
  provided: string,
): action is DecisionAction {
  if (action !== 'approve' && action !== 'deny') return false;
  if (!Number.isSafeInteger(exp) || exp * 1000 <= Date.now()) return false;
  const expected = Buffer.from(decisionToken(linkNonce, action, exp));
  const given = Buffer.from(provided);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function buildApprovalUrls(
  baseUrl: string,
  requestId: string,
  linkNonce: Buffer,
  expiresAt: Date,
): { approveUrl: string; denyUrl: string; exp: number } {
  const exp = Math.floor(expiresAt.getTime() / 1000);
  const base = baseUrl.replace(/\/+$/, '');
  const url = (action: DecisionAction) =>
    `${base}/api/approvals/decision?rid=${requestId}&action=${action}&exp=${exp}&t=${decisionToken(linkNonce, action, exp)}`;
  return { approveUrl: url('approve'), denyUrl: url('deny'), exp };
}
