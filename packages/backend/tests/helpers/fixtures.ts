import { randomBytes, createHash } from 'node:crypto';

export function randomBase64(len = 32): string {
  return randomBytes(len).toString('base64');
}

export function randomHex(len = 32): string {
  return randomBytes(len).toString('hex');
}

export function fakeProjectPayload() {
  return {
    name_ct: randomBase64(16),
    name_nonce: randomBase64(24),
    wrapped_pdk_for_user: randomBase64(48),
    wrap_nonce_for_user: randomBase64(24),
  };
}

export function fakeSecretPayload() {
  return {
    wrapped_item_key: randomBase64(48),
    wik_nonce: randomBase64(24),
    name_ct: randomBase64(16),
    name_nonce: randomBase64(24),
    value_ct: randomBase64(64),
    value_nonce: randomBase64(24),
  };
}

export function fakeTokenPayload(projectId: string) {
  const lookupId = randomBytes(32);
  const tokenKey = randomBytes(32);
  const tokenId = createHash('sha256').update(lookupId).digest().toString('hex');
  const rawToken = `grnth_${lookupId.toString('base64url')}.${tokenKey.toString('base64url')}`;

  return {
    body: {
      token_id: tokenId,
      wrapped_pdk: randomBase64(48),
      wrap_nonce: randomBase64(24),
      scopes: { read: true },
      label_ct: null,
      label_nonce: null,
      ip_allowlist: null,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
    rawToken,
    tokenId,
    lookupId,
  };
}
