import { MoreThan, type Repository } from 'typeorm';
import type { EmailVerificationToken } from '../../../domain/index.js';
import type { EmailVerificationTokenRepository } from '../../../application/index.js';
import type { EmailVerificationTokenEntity } from '../entities/email-verification-token.entity.js';

export class EmailVerificationTokenRepositoryAdapter implements EmailVerificationTokenRepository {
  constructor(private readonly repository: Repository<EmailVerificationTokenEntity>) {}

  async create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    const entity = this.repository.create({
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt
    });

    await this.repository.save(entity);
  }

  async consumeByHash(tokenHash: string): Promise<EmailVerificationToken | null> {
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
