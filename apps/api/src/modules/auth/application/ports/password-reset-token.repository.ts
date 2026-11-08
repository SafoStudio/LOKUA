import type { PasswordResetToken } from '../../domain/index.js';

export interface PasswordResetTokenRepository {
  create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;

  consumeByHash(tokenHash: string): Promise<PasswordResetToken | null>;
}
