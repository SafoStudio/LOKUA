import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { verifyAccessToken } from './tokens.js';
import { usersService } from '../users/users.service.js';

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.access_token;
  if (!token) return next(new AppError('Unauthorized', 401));

  try {
    const { userId } = await verifyAccessToken(token);
    const user = await usersService.findById(userId);
    if (!user) return next(new AppError('Unauthorized', 401));

    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch {
    next(new AppError('Unauthorized', 401));
  }
}

export function requireRefreshToken(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.refresh_token;
  if (!token) return next(new AppError('Missing refresh token', 401));
  req.refreshToken = token;
  next();
}
