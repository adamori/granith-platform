import * as secretsApi from '../api/secrets.js';
import type { SecretResponse } from '../api/secrets.js';
import * as keys from '../crypto/keys.js';
import * as s from '../crypto/sodium.js';

export interface DecryptedSecret {
  id: string;
  name: string;
  value: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

let secrets = $state<DecryptedSecret[]>([]);

export function getSecrets() {
  return secrets;
}

export async function loadSecrets(projectId: string, pdk: Uint8Array) {
  const { secrets: raw } = await secretsApi.listSecrets(projectId);
  secrets = raw.map((sec) => decryptSecret(sec, pdk));
}

export async function createSecret(projectId: string, pdk: Uint8Array, name: string, value: string) {
  const itemKey = keys.generateItemKey();
  const { wrapped: wikCt, nonce: wikNonce } = keys.wrapItemKey(itemKey, pdk);
  const { ct: nameCt, nonce: nameNonce } = keys.encryptSecretField(name, itemKey);
  const { ct: valueCt, nonce: valueNonce } = keys.encryptSecretField(value, itemKey);

  const result = await secretsApi.createSecret(projectId, {
    wrapped_item_key: s.toBase64Standard(wikCt),
    wik_nonce: s.toBase64Standard(wikNonce),
    name_ct: s.toBase64Standard(nameCt),
    name_nonce: s.toBase64Standard(nameNonce),
    value_ct: s.toBase64Standard(valueCt),
    value_nonce: s.toBase64Standard(valueNonce),
  });

  secrets = [
    { id: result.id, name, value, version: result.version, createdAt: result.created_at, updatedAt: result.created_at },
    ...secrets,
  ];
}

export async function updateSecret(projectId: string, pdk: Uint8Array, secretId: string, name: string, value: string) {
  const itemKey = keys.generateItemKey();
  const { wrapped: wikCt, nonce: wikNonce } = keys.wrapItemKey(itemKey, pdk);
  const { ct: nameCt, nonce: nameNonce } = keys.encryptSecretField(name, itemKey);
  const { ct: valueCt, nonce: valueNonce } = keys.encryptSecretField(value, itemKey);

  const result = await secretsApi.updateSecret(projectId, secretId, {
    wrapped_item_key: s.toBase64Standard(wikCt),
    wik_nonce: s.toBase64Standard(wikNonce),
    name_ct: s.toBase64Standard(nameCt),
    name_nonce: s.toBase64Standard(nameNonce),
    value_ct: s.toBase64Standard(valueCt),
    value_nonce: s.toBase64Standard(valueNonce),
  });

  secrets = secrets.map((sec) =>
    sec.id === secretId ? { ...sec, name, value, version: result.version, updatedAt: result.updated_at } : sec,
  );
}

export async function deleteSecret(projectId: string, secretId: string) {
  await secretsApi.deleteSecret(projectId, secretId);
  secrets = secrets.filter((sec) => sec.id !== secretId);
}

function decryptSecret(raw: SecretResponse, pdk: Uint8Array): DecryptedSecret {
  const wikCt = s.fromBase64Standard(raw.wrapped_item_key);
  const wikNonce = s.fromBase64Standard(raw.wik_nonce);
  const itemKey = keys.unwrapItemKey(wikCt, wikNonce, pdk);
  const name = keys.decryptSecretField(s.fromBase64Standard(raw.name_ct), s.fromBase64Standard(raw.name_nonce), itemKey);
  const value = keys.decryptSecretField(s.fromBase64Standard(raw.value_ct), s.fromBase64Standard(raw.value_nonce), itemKey);
  return { id: raw.id, name, value, version: raw.version, createdAt: raw.created_at, updatedAt: raw.updated_at };
}
