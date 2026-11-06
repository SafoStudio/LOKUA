import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { isSecureCookies } from '../../../../config/env.js';
import { AppError } from '../../../../common/errors/app-error.js';

const AUTH_GOOGLE_PATH = '/api/v1/auth/google';

export const GOOGLE_STATE_COOKIE = 'googleOAuthState';

const googleStateBaseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isSecureCookies,
  sameSite: 'lax',
  path: AUTH_GOOGLE_PATH
};

export const googleStateCookieOptions: CookieOptions = {
  ...googleStateBaseCookieOptions,
  maxAge: 5 * 60 * 1000
};

export function createGoogleState(): string {
  return randomBytes(32).toString('hex');
}

export function setGoogleStateCookie(res: Response, state: string): void {
  res.cookie(GOOGLE_STATE_COOKIE, state, googleStateCookieOptions);
}

export function clearGoogleStateCookie(res: Response): void {
  res.clearCookie(GOOGLE_STATE_COOKIE, googleStateBaseCookieOptions);
}

export function verifyGoogleState(req: Request, receivedState: unknown): void {
  const cookieState = req.cookies?.[GOOGLE_STATE_COOKIE];

  if (typeof cookieState !== 'string' || typeof receivedState !== 'string') {
    throw new AppError('Invalid OAuth state', 400);
  }

  const expected = Buffer.from(cookieState);
  const received = Buffer.from(receivedState);

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new AppError('Invalid OAuth state', 400);
  }
}
