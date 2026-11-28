import type { RequestHandler } from 'express';
import { AppError } from '../../../../common/index.js';
import { env } from '../../../../config/env.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './cookies.js';

const clientOrigin = new URL(env.CLIENT_URL).origin;
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export const requireTrustedCookieOrigin: RequestHandler = (req, _res, next) => {
  const hasAuthCookie = Boolean(
    req.cookies?.[ACCESS_TOKEN_COOKIE] || req.cookies?.[REFRESH_TOKEN_COOKIE]
  );
  if (safeMethods.has(req.method) || !hasAuthCookie) return next();

  const origin = req.get('Origin');
  const fetchSite = req.get('Sec-Fetch-Site');
  if (
    (origin !== undefined && origin !== clientOrigin) ||
    (origin === undefined && fetchSite !== undefined)
  ) {
    return next(new AppError('Untrusted request origin', 403));
  }
  next();
};
