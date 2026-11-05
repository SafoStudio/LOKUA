import 'dotenv/config';
import { z } from 'zod';
import logger from '../common/logger.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3003),
  CLIENT_URL: z.url(),
  DATABASE_URL: z.url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  logger.fatal({ errors: z.treeifyError(parsedEnv.error) }, 'Invalid environment variables');
  process.exit(1);
}
export const env = parsedEnv.data;
export const isDev = env.NODE_ENV !== 'production';
