import { z } from 'zod';

export const registerStartBody = z.object({
  handle: z.string().min(1).max(64),
  registrationRequest: z.string(),
});

export const registerFinishBody = z.object({
  handle: z.string().min(1).max(64),
  registrationRecord: z.string(),
  kdf_params: z.object({
    algorithm: z.string(),
    time_cost: z.number().int().positive(),
    memory_cost: z.number().int().positive(),
    parallelism: z.number().int().positive(),
    salt_length: z.number().int().positive(),
  }),
});

export const loginStartBody = z.object({
  handle: z.string().min(1).max(64),
  startLoginRequest: z.string(),
});

export const loginFinishBody = z.object({
  login_id: z.string().uuid(),
  finishLoginRequest: z.string(),
});
