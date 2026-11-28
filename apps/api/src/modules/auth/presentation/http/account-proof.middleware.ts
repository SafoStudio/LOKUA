import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../../../common/index.js';
import type { AccountEmailCodeUseCase } from '../../application/use-cases/account-email-code.use-case.js';
import { accountProof } from './reauthentication.js';
import type { createReauthentication } from './reauthentication.js';

const proofSchema = z.strictObject({ proof: accountProof });

export function createAccountProofHandlers(
  emailCodes: AccountEmailCodeUseCase,
  reauthenticate: ReturnType<typeof createReauthentication>
) {
  const authorize: RequestHandler = async (req, _res, next) => {
    if (!req.user) throw new AppError('Authentication required', 401);
    const { proof } = proofSchema.parse(req.body);
    if (proof.method === 'email') {
      await emailCodes.verifyCode(req.user, proof.code);
    } else {
      await reauthenticate(req, proof);
    }
    next();
  };

  const requestCode: RequestHandler = async (req, res) => {
    if (!req.user) throw new AppError('Authentication required', 401);
    await emailCodes.requestCode(req.user);
    res.set('Cache-Control', 'no-store').status(202).end();
  };

  return { authorize, requestCode };
}
