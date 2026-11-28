import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { TokenService } from '../../application/index.js';
import type { AuthUserProvider, AccessService } from '../../../users/index.js';
import { AppError } from '../../../../common/index.js';

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './cookies.js';

interface AuthMiddlewareDependencies {
  tokenService: TokenService;
  users: AuthUserProvider;
  access: AccessService;
}

export function createAuthMiddleware({ tokenService, users, access }: AuthMiddlewareDependencies) {
  function authenticate(required: boolean): RequestHandler {
    return async (req, _res, next) => {
      const authorization = req.headers.authorization;

      const token = authorization?.startsWith('Bearer ')
        ? authorization.slice(7)
        : req.cookies?.[ACCESS_TOKEN_COOKIE];

      if (!token) {
        return required ? next(new AppError('Authentication required', 401)) : next();
      }

      let payload: Awaited<ReturnType<typeof tokenService.verifyAccessToken>>;

      try {
        payload = await tokenService.verifyAccessToken(token);
      } catch {
        return next(new AppError('Invalid or expired access token', 401));
      }

      const user = await users.findById(payload.userId);
      if (!user) return next(new AppError('User not found', 401));

      if (access.isBlocked(user)) return next(new AppError('Account is blocked', 403));
      if (user.sessionVersion !== payload.sessionVersion) {
        return next(new AppError('Invalid or expired access token', 401));
      }

      req.user = user;

      next();
    };
  }

  const requireRefreshToken: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!token) return next(new AppError('Refresh token required', 401));

    req.refreshToken = token;
    next();
  };

  return {
    requireAuth: authenticate(true),
    optionalAuth: authenticate(false),
    requireRefreshToken
  };
}
