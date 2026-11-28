import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import { AppError } from '../../../../common/index.js';

export function createPrivateUsersRouter(requireAuth: RequestHandler) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  }, requireAuth);
  return router;
}

export function requireCurrentUserId(req: Request): string {
  if (!req.user) throw new AppError('Authentication required', 401);
  return req.user.id;
}
