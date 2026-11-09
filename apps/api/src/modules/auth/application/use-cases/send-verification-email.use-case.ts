import { randomBytes, createHash } from 'node:crypto';
import type { UserProvider } from '../ports/user.provider.js';
import type { EmailVerificationTokenRepository } from '../ports/email-verification-token.repository.js';
import type { EmailService } from '../ports/email.service.js';
import { AppError } from '../../../../common/index.js';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export class SendVerificationEmailUseCase {
  constructor(
    private readonly users: UserProvider,
    private readonly tokens: EmailVerificationTokenRepository,
    private readonly emailService: EmailService
  ) {}

  async execute(userId: string): Promise<void> {
    const user = await this.users.findById(userId);

    if (!user) throw new AppError('User not found', 404);

    if (user.emailVerified) return;

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await this.tokens.create({
      userId: user.id,
      tokenHash,
      expiresAt
    });

    await this.emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      token
    });
  }
}
