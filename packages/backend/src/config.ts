import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  OPAQUE_SERVER_SETUP: z.string().min(1),
  ADMIN_KEY: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TRUST_PROXY: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean)),
  BODY_LIMIT: z.coerce.number().default(524_288),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(): Config {
  return envSchema.parse(process.env);
}
