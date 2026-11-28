import 'dotenv/config';
import { z } from 'zod';
import { logger } from '../common/index.js';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3003),
    BIND_HOST: z.string().min(1).optional(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
    APP_URL: z.url(),
    CLIENT_URL: z.url(),
    DATABASE_URL: z.url(),
    DATABASE_URL_DIRECT: z.url().optional(),
    NOMINATIM_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    LOG_HTTP: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),

    DB_LOGGING: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),

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
    BREVO_SENDER_EMAIL: z.email(),
    LOCAL_SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),

    STORAGE_ENDPOINT: z.url(),
    STORAGE_REGION: z.string().min(1),
    STORAGE_BUCKET: z.string().min(1),
    STORAGE_ACCESS_KEY_ID: z.string().min(1),
    STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
    STORAGE_IMAGE_SIGNING_SECRET: z.string().min(32).optional(),

    STORAGE_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),

    STORAGE_SIGNED_URL_TTL: z.coerce.number().int().positive().max(604800).default(900),

    STORAGE_MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 1024 * 1024)
  })
  .refine((value) => value.NODE_ENV !== 'production' || value.LOCAL_SMTP_PORT === undefined, {
    path: ['LOCAL_SMTP_PORT'],
    message: 'Local SMTP is only supported outside production'
  })
  .refine((value) => value.NODE_ENV !== 'production' || value.STORAGE_IMAGE_SIGNING_SECRET, {
    path: ['STORAGE_IMAGE_SIGNING_SECRET'],
    message: 'A stable image signing secret is required in production'
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
