import { z } from 'zod';

export const createTokenBody = z.object({
  token_id: z.string(),
  wrapped_pdk: z.string(),
  wrap_nonce: z.string(),
  scopes: z.object({
    read: z.boolean(),
    write: z.boolean().optional(),
  }),
  label_ct: z.string().nullable().optional(),
  label_nonce: z.string().nullable().optional(),
  ip_allowlist: z.array(z.string()).nullable().optional(),
  expires_at: z.string().datetime(),
});

export const tokenIdParam = z.object({
  token_id: z.string(),
});

export const patchTokenBody = z.object({
  label_ct: z.string().nullable().optional(),
  label_nonce: z.string().nullable().optional(),
  ip_allowlist: z.array(z.string()).nullable().optional(),
});
