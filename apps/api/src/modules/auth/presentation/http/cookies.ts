import type { CookieOptions, Response } from 'express';
import { isSecureCookies } from '../../../../config/env.js';

const AUTH_PATH = '/api/v1/auth';

export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

const commonCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isSecureCookies,
  sameSite: 'lax'
};

export const accessCookieOptions: CookieOptions = {
  ...commonCookieOptions,
  path: AUTH_PATH
};

export const refreshCookieOptions: CookieOptions = {
  ...commonCookieOptions,
  path: `${AUTH_PATH}/refresh`
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessCookieOptions);
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, accessCookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, refreshCookieOptions);
}
