import sodium from 'libsodium-wrappers-sumo';
import * as opaque from '@serenity-kit/opaque';

let initialized = false;

export async function initCrypto(): Promise<void> {
  if (initialized) return;
  await sodium.ready;
  await opaque.ready;
  initialized = true;
}

export function isReady(): boolean {
  return initialized;
}
