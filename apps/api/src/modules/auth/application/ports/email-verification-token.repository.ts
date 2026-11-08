import type { EmailVerificationToken } from '../../domain/index.js';

export interface EmailVerificationTokenRepository {
  create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;

  consumeByHash(tokenHash: string): Promise<EmailVerificationToken | null>;
}
