import type { DataSource, EntityManager, QueryDeepPartialEntity } from 'typeorm';
import { IsNull } from 'typeorm';
import type { UserOnboardingProvider } from '../../../application/index.js';
import { UserEntity } from '../entities/user.entity.js';
import { UserPhotoEntity } from '../entities/user-photo.entity.js';
import { UserInterestEntity } from '../entities/user-interest.entity.js';
import type { TransactionContext } from '../../../../../common/index.js';
import { AppError, toEntityManager } from '../../../../../common/index.js';

export class UserOnboardingProviderAdapter implements UserOnboardingProvider {
  constructor(private readonly dataSource: DataSource) {}

  async lockActiveAccount(userId: string, tx: TransactionContext): Promise<void> {
    const user = await toEntityManager(tx)
      .getRepository(UserEntity)
      .findOne({
        where: { id: userId, status: 'ACTIVE' },
        select: { id: true },
        lock: { mode: 'pessimistic_write' }
      });
    if (!user) throw new AppError('Account is unavailable', 403);
  }

  async applyDateOfBirth(userId: string, birthDate: Date, tx?: TransactionContext): Promise<void> {
    await this.withManager(tx, async (m) => {
      const result = await m
        .getRepository(UserEntity)
        .update({ id: userId, status: 'ACTIVE', birthDate: IsNull() }, { birthDate });
      if (!result.affected) throw new AppError('Date of birth is already set or unavailable', 409);
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
      const primary = await photos.findOne({ where: { userId, isPrimary: true } });
      await photos.update({ userId }, { isPrimary: false });
      const existing = await photos.findOne({
        where: { userId, url: data.mainPhotoUrl }
      });

      if (existing) {
        await photos.update({ id: existing.id }, { isPrimary: true, orderNum: 0 });
      } else if (primary) {
        await photos.update(
          { id: primary.id },
          { url: data.mainPhotoUrl, isPrimary: true, orderNum: 0 }
        );
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
      const users = m.getRepository(UserEntity);
      const result = await users.update(
        { id: userId, status: 'ACTIVE', emailVerified: true, onboardingCompleted: false },
        { onboardingCompleted: true }
      );
      if (result.affected) return;

      const user = await users.findOneBy({ id: userId });
      if (!user || user.status !== 'ACTIVE') throw new AppError('Account is unavailable', 403);
      if (user.onboardingCompleted) throw new AppError('Onboarding already completed', 409);
      throw new AppError('Verify your email before completing onboarding', 403);
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
