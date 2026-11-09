import { createHash } from 'node:crypto';
import type { PasswordCredentialRepository } from '../ports/password-credential.repository.js';
import type { PasswordResetTokenRepository } from '../ports/password-reset-token.repository.js';
import type { PasswordHasher } from '../ports/password-hasher.js';
import type { RefreshSessionRepository } from '../ports/refresh-session.repository.js';
import type { SecurityEventRepository } from '../ports/security-event.repository.js';
import type { SecurityContext } from '../security-context.js';
import { AppError } from '../../../../common/index.js';
import { validatePasswordLength } from '../validation/password.validation.js';

export class ResetPasswordUseCase {
  constructor(
    private readonly tokens: PasswordResetTokenRepository,
    private readonly passwordCredentials: PasswordCredentialRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly refreshSessions: RefreshSessionRepository,
    private readonly securityEvents: SecurityEventRepository
  ) {}

  async execute(
    input: { token: string; password: string },
    context: SecurityContext
  ): Promise<void> {
    if (!input.token) throw new AppError('Reset token is required', 400);

    const tokenHash = createHash('sha256').update(input.token).digest('hex');

    const consumed = await this.tokens.consumeByHash(tokenHash);

    if (!consumed) throw new AppError('Invalid or expired reset token', 400);

    validatePasswordLength(input.password);
    const passwordHash = await this.passwordHasher.hash(input.password);

    await this.passwordCredentials.updatePasswordHash(consumed.userId, passwordHash);

    await this.refreshSessions.revokeAllByUserId(consumed.userId);

    await this.securityEvents.record({
      userId: consumed.userId,
      eventType: 'PASSWORD_RESET_COMPLETED',
      ip: context.ip,
      userAgent: context.userAgent
    });
  }
}
