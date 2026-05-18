import { z } from 'zod';

export const createSecretBody = z.object({
  wrapped_item_key: z.string(),
  wik_nonce: z.string(),
  name_ct: z.string(),
  name_nonce: z.string(),
  value_ct: z.string(),
  value_nonce: z.string(),
});

export const updateSecretBody = createSecretBody;

export const secretIdParam = z.object({
  id: z.string().uuid(),
  sid: z.string().uuid(),
});
