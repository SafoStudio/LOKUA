import type { Repository } from 'typeorm';
import type { PasskeyChallenge, PasskeyChallengeType } from '../../../domain/index.js';
import type { PasskeyChallengeRepository } from '../../../application/index.js';
import { PasskeyChallengeEntity } from '../entities/passkey-challenge.entity.js';

export class PasskeyChallengeRepositoryAdapter implements PasskeyChallengeRepository {
  constructor(private readonly repository: Repository<PasskeyChallengeEntity>) {}

  async create(data: {
    challenge: string;
    type: PasskeyChallengeType;
    userId?: string | null;
    email?: string | null;
    name?: string | null;
    expiresAt: Date;
  }): Promise<void> {
    const entity = this.repository.create({
      challenge: data.challenge,
      type: data.type,
      userId: data.userId ?? null,
      email: data.email ?? null,
      name: data.name ?? null,
      expiresAt: data.expiresAt
    });

    await this.repository.save(entity);
  }

  async consume(data: {
    challenge: string;
    type: PasskeyChallengeType;
  }): Promise<PasskeyChallenge | null> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(PasskeyChallengeEntity)
      .where('challenge = :challenge', {
        challenge: data.challenge
      })
      .andWhere('type = :type', {
        type: data.type
      })
      .andWhere('expires_at > :now', {
        now: new Date()
      })
      .returning('*')
      .execute();

    const entity = result.raw[0] as
      | {
          id: string;
          challenge: string;
          type: PasskeyChallengeType;
          user_id: string | null;
          email: string | null;
          name: string | null;
          expires_at: Date | string;
          created_at: Date | string;
        }
      | undefined;

    if (!entity) {
      return null;
    }

    return {
      id: entity.id,
      challenge: entity.challenge,
      type: entity.type,
      userId: entity.user_id,
      email: entity.email,
      name: entity.name,
      expiresAt: new Date(entity.expires_at),
      createdAt: new Date(entity.created_at)
    };
  }
}
