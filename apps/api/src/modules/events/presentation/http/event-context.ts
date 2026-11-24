import type { Request } from 'express';
import type { EventContext } from '../../application/index.js';
import { AppError } from '../../../../common/index.js';

export function toEventContext(req: Request): EventContext {
  if (!req.user) throw new AppError('Authentication required', 401);

  return {
    user: req.user,
    ip: req.ip ?? null
  };
}
