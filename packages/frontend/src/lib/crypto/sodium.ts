import sodium from 'libsodium-wrappers-sumo';

export function generateKey(): Uint8Array {
  return sodium.crypto_aead_xchacha20poly1305_ietf_keygen();
}

export function generateNonce(): Uint8Array {
  return sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
}

export function encrypt(plaintext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
  return sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, null, null, nonce, key);
}

export function decrypt(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, null, nonce, key);
}

export function wrapKey(keyToWrap: Uint8Array, wrappingKey: Uint8Array): { ct: Uint8Array; nonce: Uint8Array } {
  const nonce = generateNonce();
  const ct = encrypt(keyToWrap, wrappingKey, nonce);
  return { ct, nonce };
}

export function unwrapKey(ct: Uint8Array, nonce: Uint8Array, wrappingKey: Uint8Array): Uint8Array {
  return decrypt(ct, wrappingKey, nonce);
}

export function deriveKeys(password: string, salt: Uint8Array): { authKey: Uint8Array; kek: Uint8Array } {
  const masterKey = sodium.crypto_pwhash(
    64,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
  const authKey = masterKey.slice(0, 32);
  const kek = masterKey.slice(32, 64);
  return { authKey, kek };
}

export function randomBytes(len: number): Uint8Array {
  return sodium.randombytes_buf(len);
}

export function toBase64(data: Uint8Array): string {
  return sodium.to_base64(data, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export function fromBase64(str: string): Uint8Array {
  return sodium.from_base64(str, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export function toBase64Standard(data: Uint8Array): string {
  return sodium.to_base64(data, sodium.base64_variants.ORIGINAL);
}

export function fromBase64Standard(str: string): Uint8Array {
  return sodium.from_base64(str, sodium.base64_variants.ORIGINAL);
}

export function toHex(data: Uint8Array): string {
  return sodium.to_hex(data);
}

export function fromHex(str: string): Uint8Array {
  return sodium.from_hex(str);
}
