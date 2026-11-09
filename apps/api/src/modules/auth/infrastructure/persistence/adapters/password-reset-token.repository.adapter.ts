import { MoreThan, type Repository } from 'typeorm';
import type { PasswordResetToken } from '../../../domain/index.js';
import type { PasswordResetTokenRepository } from '../../../application/index.js';
import type { PasswordResetTokenEntity } from '../entities/password-reset-token.entity.js';

export class PasswordResetTokenRepositoryAdapter implements PasswordResetTokenRepository {
  constructor(private readonly repository: Repository<PasswordResetTokenEntity>) {}

  async create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    const entity = this.repository.create({
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt
    });

    await this.repository.save(entity);
  }

  async consumeByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const entity = await this.repository.findOne({
      where: {
        tokenHash,
        expiresAt: MoreThan(new Date())
      }
    });

    if (!entity) return null;

    const deleteResult = await this.repository.delete({ id: entity.id });

    if (!deleteResult.affected) return null;

    return {
      id: entity.id,
      userId: entity.userId,
      tokenHash: entity.tokenHash,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt
    };
  }
}
