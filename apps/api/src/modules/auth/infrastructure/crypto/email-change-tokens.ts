import { createHash, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { AppError } from '../../../../common/index.js';
import type { AuthUser } from '../../../users/index.js';
import type { EmailChangeTokens } from '../../application/use-cases/change-email.use-case.js';

const audience = 'lokua-email-change';
const type = 'lokua-email-change+jwt';

export class JwtEmailChangeTokens implements EmailChangeTokens {
  private readonly secret: Uint8Array;

  constructor(secret: string) {
    this.secret = new TextEncoder().encode(secret);
  }

  issue(user: AuthUser, email: string, expiresAt: Date): Promise<string> {
    return new SignJWT({ email, currentEmail: user.email, sessionVersion: user.sessionVersion })
      .setProtectedHeader({ alg: 'HS256', typ: type })
      .setSubject(user.id)
      .setAudience(audience)
      .setJti(randomUUID())
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.secret);
  }

  async read(token: string, user: AuthUser): Promise<string> {
    const verified = await jwtVerify(token, this.secret, {
      algorithms: ['HS256'],
      audience,
      typ: type,
      subject: user.id
    }).catch(() => null);
    const claims = verified?.payload;
    if (
      !claims ||
      typeof claims.email !== 'string' ||
      claims.currentEmail !== user.email ||
      claims.sessionVersion !== user.sessionVersion
    ) {
      throw new AppError('Посилання для зміни email недійсне або прострочене', 400);
    }
    return claims.email;
  }

  hash(token: string): string {
    return createHash('sha256').update('email-change:').update(token).digest('hex');
  }
}
