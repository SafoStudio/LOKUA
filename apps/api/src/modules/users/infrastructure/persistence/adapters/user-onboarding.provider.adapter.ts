import type { DataSource, EntityManager, QueryDeepPartialEntity } from 'typeorm';
import type { UserOnboardingProvider } from '../../../application/index.js';
import { UserEntity } from '../entities/user.entity.js';
import { UserPhotoEntity } from '../entities/user-photo.entity.js';
import { UserInterestEntity } from '../entities/user-interest.entity.js';

export class UserOnboardingProviderAdapter implements UserOnboardingProvider {
  constructor(private readonly dataSource: DataSource) {}

  async applyDateOfBirth(userId: string, birthDate: Date, manager?: EntityManager): Promise<void> {
    await this.withManager(manager, async (m) => {
      await m.getRepository(UserEntity).update({ id: userId }, { birthDate });
    });
  }

  async applyProfile(
    userId: string,
    data: { name: string; mainPhotoUrl: string },
    manager?: EntityManager
  ): Promise<void> {
    await this.withManager(manager, async (m) => {
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

  async applyCity(userId: string, cityId: string, manager?: EntityManager): Promise<void> {
    await this.withManager(manager, async (m) => {
      await m.getRepository(UserEntity).update({ id: userId }, { cityId });
    });
  }

  async applyInterests(
    userId: string,
    interestIds: string[],
    manager?: EntityManager
  ): Promise<void> {
    await this.withManager(manager, async (m) => {
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
    manager?: EntityManager
  ): Promise<void> {
    await this.withManager(manager, async (m) => {
      const patch: QueryDeepPartialEntity<UserEntity> = {};
      if (data.bio !== undefined) patch.bio = data.bio;
      if (data.languages !== undefined) patch.languages = data.languages;
      if (data.socialLinks !== undefined) patch.socialLinks = data.socialLinks;
      if (Object.keys(patch).length === 0) return;
      await m.getRepository(UserEntity).update({ id: userId }, patch);
    });
  }

  async completeOnboarding(userId: string, manager?: EntityManager): Promise<void> {
    await this.withManager(manager, async (m) => {
      await m.getRepository(UserEntity).update({ id: userId }, { onboardingCompleted: true });
    });
  }

  private async withManager(
    manager: EntityManager | undefined,
    fn: (m: EntityManager) => Promise<void>
  ): Promise<void> {
    if (manager) {
      await fn(manager);
      return;
    }
    await this.dataSource.transaction(fn);
  }
}
