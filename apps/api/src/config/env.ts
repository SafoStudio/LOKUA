import 'dotenv/config';
import { z } from 'zod';
import { logger } from '../common/index.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3003),
  APP_URL: z.url(),
  CLIENT_URL: z.url(),
  DATABASE_URL: z.url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.url(),
  GOOGLE_SUCCESS_REDIRECT: z.url(),

  WEBAUTHN_RP_ID: z.string().min(1),
  WEBAUTHN_RP_NAME: z.string().min(1),
  WEBAUTHN_ORIGIN: z.url(),

  BREVO_SMTP_USER: z.string().min(1),
  BREVO_SMTP_KEY: z.string().min(1),
  BREVO_SENDER_EMAIL: z.email()
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  logger.fatal({ errors: z.treeifyError(parsedEnv.error) }, 'Invalid environment variables');
  process.exit(1);
}

export const env = parsedEnv.data;

export const isDev = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isSecureCookies = isProduction;
