import * as s from './sodium.js';
import { createHashAsync } from './hash.js';

export function generatePDK(): Uint8Array {
  return s.generateKey();
}

export function generateItemKey(): Uint8Array {
  return s.generateKey();
}

export function wrapPDKForUser(pdk: Uint8Array, kek: Uint8Array): { wrapped: Uint8Array; nonce: Uint8Array } {
  const { ct, nonce } = s.wrapKey(pdk, kek);
  return { wrapped: ct, nonce };
}

export function unwrapPDKForUser(wrapped: Uint8Array, nonce: Uint8Array, kek: Uint8Array): Uint8Array {
  return s.unwrapKey(wrapped, nonce, kek);
}

export function wrapItemKey(itemKey: Uint8Array, pdk: Uint8Array): { wrapped: Uint8Array; nonce: Uint8Array } {
  const { ct, nonce } = s.wrapKey(itemKey, pdk);
  return { wrapped: ct, nonce };
}

export function unwrapItemKey(wrapped: Uint8Array, nonce: Uint8Array, pdk: Uint8Array): Uint8Array {
  return s.unwrapKey(wrapped, nonce, pdk);
}

export function wrapPDKForToken(pdk: Uint8Array, tokenKey: Uint8Array): { wrapped: Uint8Array; nonce: Uint8Array } {
  const { ct, nonce } = s.wrapKey(pdk, tokenKey);
  return { wrapped: ct, nonce };
}

export function encryptSecretField(plaintext: string, itemKey: Uint8Array): { ct: Uint8Array; nonce: Uint8Array } {
  const data = new TextEncoder().encode(plaintext);
  const nonce = s.generateNonce();
  const ct = s.encrypt(data, itemKey, nonce);
  return { ct, nonce };
}

export function decryptSecretField(ct: Uint8Array, nonce: Uint8Array, itemKey: Uint8Array): string {
  const data = s.decrypt(ct, itemKey, nonce);
  return new TextDecoder().decode(data);
}

export function encryptProjectName(name: string, pdk: Uint8Array): { ct: Uint8Array; nonce: Uint8Array } {
  const data = new TextEncoder().encode(name);
  const nonce = s.generateNonce();
  const ct = s.encrypt(data, pdk, nonce);
  return { ct, nonce };
}

export function decryptProjectName(ct: Uint8Array, nonce: Uint8Array, pdk: Uint8Array): string {
  const data = s.decrypt(ct, pdk, nonce);
  return new TextDecoder().decode(data);
}

export function generateTokenPair(): { lookupId: Uint8Array; tokenKey: Uint8Array; rawToken: string } {
  const lookupId = s.randomBytes(32);
  const tokenKey = s.generateKey();
  const rawToken = `grnth_${s.toBase64(lookupId)}.${s.toBase64(tokenKey)}`;
  return { lookupId, tokenKey, rawToken };
}
