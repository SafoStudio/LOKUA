import { createHash } from 'node:crypto';
import type { UserProvider } from '../ports/user.provider.js';
import type { EmailVerificationTokenRepository } from '../ports/email-verification-token.repository.js';
import type { SecurityEventRepository } from '../ports/security-event.repository.js';
import type { SecurityContext } from '../security-context.js';
import { AppError } from '../../../../common/index.js';

export class VerifyEmailUseCase {
  constructor(
    private readonly tokens: EmailVerificationTokenRepository,
    private readonly users: UserProvider,
    private readonly securityEvents: SecurityEventRepository
  ) {}

  async execute(token: string, context: SecurityContext): Promise<void> {
    if (!token) throw new AppError('Verification token is required', 400);

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const consumed = await this.tokens.consumeByHash(tokenHash);

    if (!consumed) throw new AppError('Invalid or expired verification token', 400);

    await this.users.markEmailVerified(consumed.userId);

    await this.securityEvents.record({
      userId: consumed.userId,
      eventType: 'EMAIL_VERIFIED',
      ip: context.ip,
      userAgent: context.userAgent
    });
  }
}
