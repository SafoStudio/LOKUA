import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../../../common/index.js';
import { validate } from '../../../../middlewares/index.js';
import type { ChangeEmailUseCase } from '../../application/use-cases/change-email.use-case.js';
import type {
  CompletePasskeyLoginUseCase,
  LoginWithPasswordUseCase
} from '../../application/index.js';
import { createRequestRateLimit } from '../../../../middlewares/request-rate-limit.js';
import { createReauthentication, reauthenticationProof } from './reauthentication.js';

const requestBody = z.strictObject({
  email: z.string().trim().max(255).pipe(z.email()),
  proof: reauthenticationProof
});
const confirmBody = z.strictObject({ token: z.string().min(1).max(2048) });

export function createEmailChangeRouter(
  requireAuth: RequestHandler,
  changeEmail: ChangeEmailUseCase,
  login: Pick<LoginWithPasswordUseCase, 'execute'>,
  passkey: Pick<CompletePasskeyLoginUseCase, 'verify'>,
  limit = createRequestRateLimit({
    limit: 5,
    windowMs: 15 * 60_000,
    key: (req) => req.user?.id ?? 'unknown'
  })
) {
  const router = Router();
  const reauthenticate = createReauthentication(login, passkey);
  router.post(
    '/change-email',
    requireAuth,
    limit,
    validate({ body: requestBody }),
    async (req, res) => {
      const { email, proof } = req.body as z.infer<typeof requestBody>;
      const verified = await reauthenticate(req, proof);
      await changeEmail.request(verified, email);
      res.set('Cache-Control', 'no-store').status(202).end();
    }
  );
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
