import type { Repository } from 'typeorm';
import type { RefreshSession } from '../../../domain/index.js';
import type { RefreshSessionRepository } from '../../../application/index.js';
import { RefreshSessionEntity } from '../entities/refresh-session.entity.js';

export class RefreshSessionRepositoryAdapter implements RefreshSessionRepository {
  constructor(private readonly repository: Repository<RefreshSessionEntity>) {}

  async create(data: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    const entity = this.repository.create({
      id: data.id,
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null
    });

    await this.repository.save(entity);
  }

  async findById(id: string): Promise<RefreshSession | null> {
    const entity = await this.repository.findOne({
      where: { id }
    });

    return entity ? this.toDomain(entity) : null;
  }

  async revokeById(id: string): Promise<void> {
    await this.repository.update({ id }, { revokedAt: new Date() });
  }

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(RefreshSessionEntity)
      .set({ revokedAt: new Date() })
      .where('token_hash = :tokenHash', { tokenHash })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(RefreshSessionEntity)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private toDomain(entity: RefreshSessionEntity): RefreshSession {
    return {
      id: entity.id,
      userId: entity.userId,
      tokenHash: entity.tokenHash,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
      revokedAt: entity.revokedAt
    };
  }
}
