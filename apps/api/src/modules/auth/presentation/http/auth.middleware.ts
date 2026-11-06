import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { TokenService, UserProvider } from '../../application/index.js';
import { AppError } from '../../../../common/errors/app-error.js';

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './cookies.js';

interface AuthMiddlewareDependencies {
  tokenService: TokenService;
  users: UserProvider;
}

export function createAuthMiddleware({ tokenService, users }: AuthMiddlewareDependencies) {
  const requireAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authorization = req.headers.authorization;

      const token = authorization?.startsWith('Bearer ')
        ? authorization.slice(7)
        : req.cookies?.[ACCESS_TOKEN_COOKIE];

      if (!token) throw new AppError('Authentication required', 401);

      let payload;

      try {
        payload = await tokenService.verifyAccessToken(token);
      } catch {
        throw new AppError('Invalid or expired access token', 401);
      }

      const user = await users.findById(payload.userId);
      if (!user) throw new AppError('User not found', 401);

      req.user = user;

      next();
    } catch (error) {
      next(error);
    }
  };

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
    requireAuth,
    requireRefreshToken
  };
}
