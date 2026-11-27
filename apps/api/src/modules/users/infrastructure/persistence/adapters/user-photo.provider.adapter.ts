import type { DataSource } from 'typeorm';
import { AppError } from '../../../../../common/index.js';
import type { UserPhotoProvider } from '../../../application/ports/user-photo.provider.js';
import { UserEntity } from '../entities/user.entity.js';
import { UserPhotoEntity } from '../entities/user-photo.entity.js';

export class UserPhotoProviderAdapter implements UserPhotoProvider {
  constructor(private readonly dataSource: DataSource) {}

  async list(userId: string): Promise<string[]> {
    const photos = await this.dataSource.getRepository(UserPhotoEntity).find({
      where: { userId },
      order: { isPrimary: 'DESC', orderNum: 'ASC', createdAt: 'ASC', id: 'ASC' },
      take: 3
    });
    return photos.map(({ url }) => url);
  }

  replace(userId: string, photoUrls: string[]): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(UserEntity).findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' }
      });
      if (!user || user.status !== 'ACTIVE' || !user.emailVerified || !user.onboardingCompleted) {
        throw new AppError('Profile photo changes are unavailable for this account', 403);
      }
      const photos = manager.getRepository(UserPhotoEntity);
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
