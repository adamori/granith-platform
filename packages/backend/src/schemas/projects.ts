import { z } from 'zod';

export const createProjectBody = z.object({
  name_ct: z.string(),
  name_nonce: z.string(),
  wrapped_pdk_for_user: z.string(),
  wrap_nonce_for_user: z.string(),
});

export const projectIdParam = z.object({
  id: z.string().uuid(),
});
