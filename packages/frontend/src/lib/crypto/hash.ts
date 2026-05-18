export async function createHashAsync(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
  return new Uint8Array(hash);
}
