import { z } from 'zod';

export const uuidParam = z.object({
  id: z.string().uuid(),
});

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const byteaHex = z.string().regex(/^[0-9a-f]+$/i);

export const bufferFromHex = byteaHex.transform((v) => Buffer.from(v, 'hex'));

export const bufferFromBase64 = z.string().transform((v) => Buffer.from(v, 'base64'));
