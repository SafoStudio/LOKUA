import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../../../common/index.js';
import type { AuthorizePasskeyEnrollmentUseCase } from '../../application/use-cases/authorize-passkey-enrollment.use-case.js';
import { enrollmentProof } from './reauthentication.js';
import type { createReauthentication } from './reauthentication.js';

const enrollmentSchema = z.strictObject({ proof: enrollmentProof });

export function createPasskeyEnrollmentHandlers(
  enrollment: AuthorizePasskeyEnrollmentUseCase,
  reauthenticate: ReturnType<typeof createReauthentication>
) {
  const authorize: RequestHandler = async (req, _res, next) => {
    if (!req.user) throw new AppError('Authentication required', 401);
    const { proof } = enrollmentSchema.parse(req.body);
    if (proof.method === 'email') {
      await enrollment.verifyCode(req.user, proof.code);
    } else {
      await reauthenticate(req, proof);
    }
    next();
  };

  const requestCode: RequestHandler = async (req, res) => {
    if (!req.user) throw new AppError('Authentication required', 401);
    await enrollment.requestCode(req.user);
    res.set('Cache-Control', 'no-store').status(202).end();
  };

  return { authorize, requestCode };
}
