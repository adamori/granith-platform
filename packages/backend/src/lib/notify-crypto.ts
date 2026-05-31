import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// SERVER-SIDE encryption for notification driver credentials.
//
// IMPORTANT: This is NOT the end-to-end-encryption path used for project secrets.
// The server must hold plaintext driver credentials (e.g. a Telegram bot token) at
// send time to call the provider's API, so these are encrypted at rest with a
// server-held key (NOTIFY_ENCRYPTION_KEY) that the server can decrypt. Treat the
// stored ciphertext as recoverable plaintext from the server's point of view.

// Derive a stable 32-byte AES-256 key from the configured secret (any length >= 32).
function deriveKey(masterKey: string): Buffer {
  return createHash('sha256').update(masterKey, 'utf8').digest();
}

export interface SealedCredential {
  ct: Buffer; // authTag (16 bytes) || ciphertext
  nonce: Buffer; // 12-byte GCM IV
}

export function sealCredential(plaintext: string, masterKey: string): SealedCredential {
  const key = deriveKey(masterKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ct: Buffer.concat([tag, enc]), nonce: iv };
}

export function openCredential(sealed: SealedCredential, masterKey: string): string {
  const key = deriveKey(masterKey);
  const tag = sealed.ct.subarray(0, 16);
  const enc = sealed.ct.subarray(16);
  const decipher = createDecipheriv('aes-256-gcm', key, sealed.nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
