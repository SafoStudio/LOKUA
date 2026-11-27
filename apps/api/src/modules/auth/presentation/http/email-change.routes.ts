import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../../../common/index.js';
import { validate } from '../../../../middlewares/index.js';
import type { ChangeEmailUseCase } from '../../application/use-cases/change-email.use-case.js';

const requestBody = z.strictObject({ email: z.string().trim().max(255).pipe(z.email()) });
const confirmBody = z.strictObject({ token: z.string().min(1).max(2048) });

export function createEmailChangeRouter(
  requireAuth: RequestHandler,
  changeEmail: ChangeEmailUseCase
) {
  const router = Router();
  router.post('/change-email', requireAuth, validate({ body: requestBody }), async (req, res) => {
    if (!req.user) throw new AppError('Потрібна авторизація', 401);
    await changeEmail.request(req.user, req.body.email);
    res.set('Cache-Control', 'no-store').status(202).end();
  });
  router.post(
    '/change-email/confirm',
    requireAuth,
    validate({ body: confirmBody }),
    async (req, res) => {
      if (!req.user) throw new AppError('Потрібна авторизація', 401);
      await changeEmail.confirm(req.user, req.body.token);
      res.set('Cache-Control', 'no-store').status(204).end();
    }
  );
  return router;
}
