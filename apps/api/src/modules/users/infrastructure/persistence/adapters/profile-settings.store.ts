import type { DataSource } from 'typeorm';
import { AppError, toEntityManager, TypeOrmUnitOfWork } from '../../../../../common/index.js';
import type { UserOnboardingProvider } from '../../../application/index.js';
import type {
  ProfileSettingsPatch,
  ProfileSettingsStore
} from '../../../application/services/profile-settings.service.js';
import { UserEntity } from '../entities/user.entity.js';

export class TypeOrmProfileSettingsStore implements ProfileSettingsStore {
  private readonly unitOfWork: TypeOrmUnitOfWork;

  constructor(
    dataSource: DataSource,
    private readonly onboarding: UserOnboardingProvider
  ) {
    this.unitOfWork = new TypeOrmUnitOfWork(dataSource);
  }

  update(userId: string, { interestIds, ...fields }: ProfileSettingsPatch): Promise<void> {
    return this.unitOfWork.run(async (tx) => {
      const users = toEntityManager(tx).getRepository(UserEntity);
      const user = await users.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' }
      });
      if (!user || user.status !== 'ACTIVE' || !user.emailVerified || !user.onboardingCompleted) {
        throw new AppError('Підтвердьте email і завершіть онбординг', 403);
      }
      if (Object.keys(fields).length) await users.update(userId, fields);
      if (interestIds) await this.onboarding.applyInterests(userId, interestIds, tx);
    });
  }
}
