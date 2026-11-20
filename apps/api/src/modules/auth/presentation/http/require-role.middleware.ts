import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { UserRole } from '../../../users/index.js';
import { AppError } from '../../../../common/index.js';

export function createRequireRole() {
  const requireRole =
    (...roles: UserRole[]): RequestHandler =>
    (req: Request, _res: Response, next: NextFunction) => {
      if (!req.user) return next(new AppError('Authentication required', 401));

      if (!roles.includes(req.user.role)) {
        return next(new AppError('Forbidden', 403));
      }

      next();
    };

  return { requireRole };
}
