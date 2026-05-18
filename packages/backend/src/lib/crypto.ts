import { createHash } from 'node:crypto';

export function hashTokenId(lookupId: Buffer): Buffer {
  return createHash('sha256').update(lookupId).digest();
}
