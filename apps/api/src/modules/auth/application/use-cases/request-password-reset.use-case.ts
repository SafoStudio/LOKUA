import { randomBytes, createHash } from 'node:crypto';
import type { UserProvider } from '../ports/user.provider.js';
import type { PasswordCredentialRepository } from '../ports/password-credential.repository.js';
import type { PasswordResetTokenRepository } from '../ports/password-reset-token.repository.js';
import type { EmailService } from '../ports/email.service.js';
import type { SecurityEventRepository } from '../ports/security-event.repository.js';
import type { SecurityContext } from '../security-context.js';
import { logger } from '../../../../common/index.js';

const TOKEN_TTL_MS = 60 * 60 * 1000;

export class RequestPasswordResetUseCase {
  constructor(
    private readonly users: UserProvider,
    private readonly passwordCredentials: PasswordCredentialRepository,
    private readonly tokens: PasswordResetTokenRepository,
    private readonly emailService: EmailService,
    private readonly securityEvents: SecurityEventRepository
  ) {}

  async execute(email: string, context: SecurityContext): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.users.findByEmail(normalizedEmail);

    if (!user) return;

    const credential = await this.passwordCredentials.findByUserId(user.id);

    if (!credential) return;

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await this.tokens.create({
      userId: user.id,
      tokenHash,
      expiresAt
    });

    try {
      await this.emailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token
      });
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to send password reset email');
    }

    await this.securityEvents.record({
      userId: user.id,
      eventType: 'PASSWORD_RESET_REQUESTED',
      ip: context.ip,
      userAgent: context.userAgent
    });
  }
}
