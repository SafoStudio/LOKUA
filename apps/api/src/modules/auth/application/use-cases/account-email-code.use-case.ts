import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '../../../../common/index.js';
import type { AuthUser } from '../../../users/index.js';
import type { PasskeyChallengeRepository } from '../ports/passkey-challenge.repository.js';

export class AccountEmailCodeUseCase {
  constructor(
    private readonly challenges: PasskeyChallengeRepository,
    private readonly purpose: 'ENROLLMENT_EMAIL' | 'DELETION_EMAIL',
    private readonly sendCode: (email: string, code: string) => Promise<void>
  ) {}

  async requestCode(user: AuthUser): Promise<void> {
    if (!user.emailVerified || user.status !== 'ACTIVE') {
      throw new AppError('Verified email required', 403);
    }
    const code = randomBytes(32).toString('base64url');
    await this.challenges.create({
      challenge: this.hash(user, code),
      type: this.purpose,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60_000)
    });
    await this.sendCode(user.email, code);
  }

  async verifyCode(user: AuthUser, code: string): Promise<void> {
    if (!user.emailVerified || user.status !== 'ACTIVE') {
      throw new AppError('Verified email required', 403);
    }
    const consumed = await this.challenges.consume({
      challenge: this.hash(user, code),
      type: this.purpose
    });
    if (!consumed) throw new AppError('Invalid or expired verification code', 400);
  }

  private hash(user: AuthUser, code: string): string {
    return createHash('sha256')
      .update(JSON.stringify([user.id, user.email, user.sessionVersion, code]))
      .digest('hex');
  }
}
