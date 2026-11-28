import { z } from 'zod';
import type { Request } from 'express';
import { AppError } from '../../../../common/index.js';
import type {
  CompletePasskeyLoginUseCase,
  LoginWithPasswordUseCase
} from '../../application/index.js';
import { toSecurityContext } from './security-context.js';

const passwordProof = z.strictObject({
  method: z.literal('password'),
  password: z.string().min(1).max(72)
});
const passkeyProof = z.strictObject({
  method: z.literal('passkey'),
  challenge: z.string().min(1).max(2048),
  response: z.record(z.string(), z.unknown())
});

export const reauthenticationProof = z.discriminatedUnion('method', [passwordProof, passkeyProof]);
export const enrollmentProof = z.discriminatedUnion('method', [
  passwordProof,
  passkeyProof,
  z.strictObject({ method: z.literal('email'), code: z.string().regex(/^[a-zA-Z0-9_-]{43}$/) })
]);

export function createReauthentication(
  login: Pick<LoginWithPasswordUseCase, 'execute'>,
  passkey: Pick<CompletePasskeyLoginUseCase, 'verify'>
) {
  return async (req: Request, proof: z.infer<typeof reauthenticationProof>) => {
    const user = req.user;
    if (!user) throw new AppError('Authentication required', 401);

    const context = toSecurityContext(req);
    const verified =
      proof.method === 'password'
        ? await login.execute({ email: user.email, password: proof.password }, context)
        : await passkey.verify(proof, context, user.id);
    if (
      verified.id !== user.id ||
      verified.sessionVersion !== user.sessionVersion ||
      verified.status !== 'ACTIVE'
    ) {
      throw new AppError('Authentication required', 401);
    }
    return verified;
  };
}
