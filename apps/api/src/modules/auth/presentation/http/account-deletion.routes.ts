import { Router } from 'express';
import type { RequestHandler } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { AppError } from '../../../../common/index.js';
import { env } from '../../../../config/env.js';
import { validate } from '../../../../middlewares/index.js';
import { clearAuthCookies } from './cookies.js';

export interface AccountDeletion {
  request(userId: string): Promise<Date>;
  restore(userId: string, requestedAt: Date): Promise<void>;
}

const secret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
const audience = 'lokua-account-recovery';
const restoreBody = z.strictObject({ token: z.string().min(1).max(2048) });
const recoveryClaims = z.object({ sub: z.uuid(), requestedAt: z.iso.datetime() });

export async function createAccountRecoveryLink(userId: string, requestedAt: Date) {
  const token = await new SignJWT({ requestedAt: requestedAt.toISOString() })
    .setProtectedHeader({ alg: 'HS256', typ: 'lokua-account-recovery+jwt' })
    .setAudience(audience)
    .setSubject(userId)
    .sign(secret);
  const url = new URL('/account/restore', env.CLIENT_URL);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

export function createAccountDeletionRouter(
  requireAuth: RequestHandler,
  accounts: AccountDeletion,
  proof: {
    authorize: RequestHandler;
    requestCode: RequestHandler;
    limitCode: RequestHandler;
    limitProof: RequestHandler;
    limitRestore: RequestHandler;
  }
) {
  const router = Router();

  router.post('/account/deletion-code', requireAuth, proof.limitCode, proof.requestCode);
  router.delete('/account', requireAuth, proof.limitProof, proof.authorize, async (req, res) => {
    if (!req.user) throw new AppError('Потрібна авторизація', 401);
    const recoverUntil = await accounts.request(req.user.id);
    clearAuthCookies(res);
    res.set('Cache-Control', 'no-store').status(202).json({ data: { recoverUntil } });
  });

  router.post(
    '/account/restore',
    proof.limitRestore,
    validate({ body: restoreBody }),
    async (req, res) => {
      const { token } = req.body as z.infer<typeof restoreBody>;
      const verified = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
        audience,
        typ: 'lokua-account-recovery+jwt'
      }).catch(() => null);
      const claims = recoveryClaims.safeParse(verified?.payload);
      if (!claims.success) {
        throw new AppError('Посилання для відновлення недійсне або прострочене', 400);
      }
      await accounts.restore(claims.data.sub, new Date(claims.data.requestedAt));
      res.set('Cache-Control', 'no-store').status(204).end();
    }
  );

  return router;
}
