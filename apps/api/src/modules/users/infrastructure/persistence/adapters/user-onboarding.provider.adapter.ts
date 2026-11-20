import type { DataSource, EntityManager, QueryDeepPartialEntity } from 'typeorm';
import type { UserOnboardingProvider } from '../../../application/index.js';
import { UserEntity } from '../entities/user.entity.js';
import { UserPhotoEntity } from '../entities/user-photo.entity.js';
import { UserInterestEntity } from '../entities/user-interest.entity.js';
import type { TransactionContext } from '../../../../../common/index.js';
import { toEntityManager } from '../../../../../common/index.js';

export class UserOnboardingProviderAdapter implements UserOnboardingProvider {
  constructor(private readonly dataSource: DataSource) {}

  async applyDateOfBirth(userId: string, birthDate: Date, tx?: TransactionContext): Promise<void> {
    await this.withManager(tx, async (m) => {
      await m.getRepository(UserEntity).update({ id: userId }, { birthDate });
    });
  }

  async applyProfile(
    userId: string,
    data: { name: string; mainPhotoUrl: string },
    tx?: TransactionContext
  ): Promise<void> {
    await this.withManager(tx, async (m) => {
      await m.getRepository(UserEntity).update({ id: userId }, { name: data.name });

      const photos = m.getRepository(UserPhotoEntity);
      await photos.update({ userId }, { isPrimary: false });
      const existing = await photos.findOne({
        where: { userId, url: data.mainPhotoUrl }
      });

      if (existing) {
        await photos.update({ id: existing.id }, { isPrimary: true, orderNum: 0 });
      } else {
        await photos.insert({
          userId,
          url: data.mainPhotoUrl,
          orderNum: 0,
          isPrimary: true
        });
      }
    });
  }

  async applyCity(userId: string, cityId: string, tx?: TransactionContext): Promise<void> {
    await this.withManager(tx, async (m) => {
      await m.getRepository(UserEntity).update({ id: userId }, { cityId });
    });
  }

  async applyInterests(
    userId: string,
    interestIds: string[],
    tx?: TransactionContext
  ): Promise<void> {
    await this.withManager(tx, async (m) => {
      const repo = m.getRepository(UserInterestEntity);
      await repo.delete({ userId });
      if (interestIds.length > 0) {
        await repo.insert(interestIds.map((interestId) => ({ userId, interestId })));
      }
    });
  }

  async applyOptionalProfile(
    userId: string,
    data: {
      bio?: string | null;
      languages?: string[] | null;
      socialLinks?: Record<string, string> | null;
    },
    tx?: TransactionContext
  ): Promise<void> {
    await this.withManager(tx, async (m) => {
      const patch: QueryDeepPartialEntity<UserEntity> = {};
      if (data.bio !== undefined) patch.bio = data.bio;
      if (data.languages !== undefined) patch.languages = data.languages;
      if (data.socialLinks !== undefined) patch.socialLinks = data.socialLinks;
      if (Object.keys(patch).length === 0) return;
      await m.getRepository(UserEntity).update({ id: userId }, patch);
    });
  }

  async completeOnboarding(userId: string, tx?: TransactionContext): Promise<void> {
    await this.withManager(tx, async (m) => {
      await m.getRepository(UserEntity).update({ id: userId }, { onboardingCompleted: true });
    });
  }

  private async withManager(
    tx: TransactionContext | undefined,
    fn: (m: EntityManager) => Promise<void>
  ): Promise<void> {
    if (tx) {
      await fn(toEntityManager(tx));
      return;
    }
    await this.dataSource.transaction(fn);
  }
}
