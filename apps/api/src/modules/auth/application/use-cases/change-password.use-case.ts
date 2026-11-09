import type { PasswordCredentialRepository } from '../ports/password-credential.repository.js';
import type { PasswordHasher } from '../ports/password-hasher.js';
import type { RefreshSessionRepository } from '../ports/refresh-session.repository.js';
import type { SecurityEventRepository } from '../ports/security-event.repository.js';
import type { SecurityContext } from '../security-context.js';
import { AppError } from '../../../../common/index.js';
import { validatePasswordLength } from '../validation/password.validation.js';

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export class ChangePasswordUseCase {
  constructor(
    private readonly passwordCredentials: PasswordCredentialRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly refreshSessions: RefreshSessionRepository,
    private readonly securityEvents: SecurityEventRepository
  ) {}

  async execute(input: ChangePasswordInput, context: SecurityContext): Promise<void> {
    const credential = await this.passwordCredentials.findByUserId(input.userId);

    if (!credential) {
      throw new AppError('Password is not set for this account', 400);
    }

    const currentMatches = await this.passwordHasher.compare(
      input.currentPassword,
      credential.passwordHash
    );

    if (!currentMatches) {
      throw new AppError('Current password is incorrect', 401);
    }

    const isSamePassword = await this.passwordHasher.compare(
      input.newPassword,
      credential.passwordHash
    );

    if (isSamePassword) {
      throw new AppError('New password must differ from current', 400);
    }

    validatePasswordLength(input.newPassword);
    const passwordHash = await this.passwordHasher.hash(input.newPassword);

    await this.passwordCredentials.updatePasswordHash(input.userId, passwordHash);

    await this.refreshSessions.revokeAllByUserId(input.userId);

    await this.securityEvents.record({
      userId: input.userId,
      eventType: 'PASSWORD_CHANGED',
      ip: context.ip,
      userAgent: context.userAgent
    });
  }
}
