import type { CookieOptions } from 'express';
import { isDev } from '../../config/env.js';

const base: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: !isDev,
  path: '/'
};

export const accessCookieOptions: CookieOptions = {
  ...base,
  maxAge: 15 * 60 * 1000
};

export const refreshCookieOptions: CookieOptions = {
  ...base,
  path: '/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

export const clearCookieOptions: CookieOptions = {
  ...base,
  path: '/'
};
