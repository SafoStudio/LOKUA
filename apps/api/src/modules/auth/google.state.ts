import crypto from 'node:crypto';
import type { CookieOptions } from 'express';
import { isDev } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';

const STATE_COOKIE = 'google_oauth_state';

export const stateCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: !isDev,
  path: '/auth/google',
  maxAge: 5 * 60 * 1000
};

export function generateState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function verifyState(cookieState: string | undefined, queryState: string | undefined): void {
  if (!cookieState || !queryState || cookieState !== queryState) {
    throw new AppError('Invalid OAuth state', 400);
  }
}

export { STATE_COOKIE };
