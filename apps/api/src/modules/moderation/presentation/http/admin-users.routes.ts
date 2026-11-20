import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { UserRole } from '../../../users/index.js';
import type { AdminUsersController } from './admin-users.controller.js';
import { changeBirthDateSchema } from './admin-users.schema.js';
import { validate } from '../../../../middlewares/index.js';

interface AdminUsersRoutesDependencies {
  controller: AdminUsersController;
  requireAuth: RequestHandler;
  requireRole: (...roles: UserRole[]) => RequestHandler;
}

export function createAdminUsersRouter({
  controller,
  requireAuth,
  requireRole
}: AdminUsersRoutesDependencies): Router {
  const router = Router();

  router.use(requireAuth, requireRole('ADMIN'));

  router.patch(
    '/users/:id/birth-date',
    validate({ body: changeBirthDateSchema }),
    controller.changeBirthDate
  );

  return router;
}
