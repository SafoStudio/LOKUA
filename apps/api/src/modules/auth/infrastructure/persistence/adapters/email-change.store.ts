import type { DataSource } from 'typeorm';
import {
  AppError,
  isUniqueConstraintViolation,
  toEntityManager,
  TypeOrmUnitOfWork
} from '../../../../../common/index.js';
import type { EmailChangeStore } from '../../../application/use-cases/change-email.use-case.js';
import { EmailVerificationTokenEntity } from '../entities/email-verification-token.entity.js';

export class TypeOrmEmailChangeStore implements EmailChangeStore {
  private readonly unitOfWork: TypeOrmUnitOfWork;

  constructor(private readonly dataSource: DataSource) {
    this.unitOfWork = new TypeOrmUnitOfWork(dataSource);
  }

  async save(userId: string, email: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const [existing] = await this.dataSource.query<{ id: string }[]>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existing) throw new AppError('Ця email-адреса вже використовується', 409);
    await this.dataSource
      .getRepository(EmailVerificationTokenEntity)
      .insert({ userId, tokenHash, expiresAt });
  }

  async confirm(
    userId: string,
    currentEmail: string,
    email: string,
    tokenHash: string
  ): Promise<void> {
    try {
      await this.unitOfWork.run(async (tx) => {
        const manager = toEntityManager(tx);
        const [account] = await manager.query<{ email: string; status: string }[]>(
          'SELECT email, status FROM users WHERE id = $1 FOR UPDATE',
          [userId]
        );
        if (account?.status !== 'ACTIVE' || account.email !== currentEmail) {
          throw new AppError('Посилання для зміни email недійсне або прострочене', 400);
        }
        const [matched] = await manager.query<{ id: string }[]>(
          'SELECT id FROM email_verification_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > now() FOR UPDATE',
          [userId, tokenHash]
        );
        if (!matched) throw new AppError('Посилання для зміни email недійсне або прострочене', 400);

        await manager.query(
          'UPDATE users SET email = $2, email_verified = true, updated_at = now() WHERE id = $1',
          [userId, email]
        );
        await manager.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
        await manager.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new AppError('Ця email-адреса вже використовується', 409);
      }
      throw error;
    }
  }
}
