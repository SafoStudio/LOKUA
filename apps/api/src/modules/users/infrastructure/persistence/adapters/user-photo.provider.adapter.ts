import type { DataSource } from 'typeorm';
import { AppError } from '../../../../../common/index.js';
import type { UserPhotoProvider } from '../../../application/ports/user-photo.provider.js';
import { hasActiveCompletedProfile } from '../../../domain/utils/profile-access.js';
import { UserEntity } from '../entities/user.entity.js';
import { UserPhotoEntity } from '../entities/user-photo.entity.js';

const photoOrder = { isPrimary: 'DESC', orderNum: 'ASC', createdAt: 'ASC', id: 'ASC' } as const;

export class UserPhotoProviderAdapter implements UserPhotoProvider {
  constructor(private readonly dataSource: DataSource) {}

  async list(userId: string): Promise<string[]> {
    const photos = await this.dataSource.getRepository(UserPhotoEntity).find({
      where: { userId },
      select: { url: true },
      order: photoOrder,
      take: 3
    });
    return photos.map(({ url }) => url);
  }

  replace(
    userId: string,
    photoUrls: string[],
    validateNewUrl: (url: string) => void
  ): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(UserEntity).findOne({
        where: { id: userId },
        select: { status: true, emailVerified: true, onboardingCompleted: true },
        lock: { mode: 'pessimistic_write' }
      });
      if (!user) throw new AppError('User not found', 404);
      if (!hasActiveCompletedProfile(user)) {
        throw new AppError('Profile photo changes are unavailable for this account', 403);
      }
      const photos = manager.getRepository(UserPhotoEntity);
      const existingUrls = new Set(
        (
          await photos.find({
            where: { userId },
            select: { url: true },
            order: photoOrder,
            take: 3
          })
        ).map(({ url }) => url)
      );
      for (const url of photoUrls) {
        if (!existingUrls.has(url)) validateNewUrl(url);
      }
      await photos.delete({ userId });
      await photos.insert(
        photoUrls.map((url, orderNum) => ({
          userId,
          url,
          orderNum,
          isPrimary: orderNum === 0
        }))
      );
    });
  }
}
