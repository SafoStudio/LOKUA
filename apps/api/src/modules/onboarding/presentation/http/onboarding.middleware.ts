import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../../../../common/index.js';

export const requireOnboardingInProgress: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) return next(new AppError('Authentication required', 401));
  if (req.user.onboardingCompleted) {
    return next(new AppError('Onboarding already completed', 409));
  }
  next();
};
