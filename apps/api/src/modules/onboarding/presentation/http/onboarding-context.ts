import type { Request } from 'express';
import type { OnboardingContext } from '../../application/index.js';
import { AppError } from '../../../../common/index.js';

export function toOnboardingContext(req: Request): OnboardingContext {
  if (!req.user) throw new AppError('Authentication required', 401);
  return {
    user: req.user,
    ip: req.ip ?? null
  };
}
