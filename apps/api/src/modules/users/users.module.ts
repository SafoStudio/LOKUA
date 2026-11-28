import type { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../common/index.js';
import type { NotificationPublisher } from '../notifications/index.js';
import type {
  UserProvider,
  AuthUserProvider,
  UserOnboardingProvider,
  UserProfileProvider
} from './application/index.js';
import { AccessService } from './application/index.js';
import { UserBlockService } from './application/services/user-block.service.js';
import { AccountDeletionService } from './application/services/account-deletion.service.js';
import type { AccountDeletionEvents } from './application/services/account-deletion.service.js';
import { TypeOrmAccountDeletionStore } from './infrastructure/persistence/adapters/account-deletion.store.js';
import { TypeOrmProfileSettingsStore } from './infrastructure/persistence/adapters/profile-settings.store.js';
import { UserPhotoProviderAdapter } from './infrastructure/persistence/adapters/user-photo.provider.adapter.js';
import {
  UserEntity,
  UserBlockEntity,
  UserBlockProviderAdapter,
  UserRepositoryAdapter,
  AuthUserProviderAdapter,
  UserOnboardingProviderAdapter,
  UserProfileProviderAdapter
} from './infrastructure/index.js';

interface CreateUsersModuleDependencies {
  dataSource: DataSource;
}

export function createUsersModule({ dataSource }: CreateUsersModuleDependencies) {
  const repository = new UserRepositoryAdapter(dataSource.getRepository(UserEntity));

  const users: UserProvider = repository;
  const authUsers: AuthUserProvider = new AuthUserProviderAdapter(repository);
  const onboarding: UserOnboardingProvider = new UserOnboardingProviderAdapter(dataSource);
  const profiles: UserProfileProvider = new UserProfileProviderAdapter(
    dataSource.getRepository(UserEntity)
  );
  const blocks = new UserBlockProviderAdapter(dataSource.getRepository(UserBlockEntity));
  const access = new AccessService();

  return {
    users,
    authUsers,
    onboarding,
    profiles,
    profileSettings: new TypeOrmProfileSettingsStore(dataSource, onboarding),
    photos: new UserPhotoProviderAdapter(dataSource),
    blocks,
    blockSettings: new UserBlockService(blocks),
    createAccountDeletion: (
      events: AccountDeletionEvents,
      notifications: NotificationPublisher,
      deleteImages: (userId: string) => Promise<void>,
      clock?: () => Date
    ) =>
      new AccountDeletionService(
        new TypeOrmUnitOfWork(dataSource),
        new TypeOrmAccountDeletionStore(),
        events,
        notifications,
        deleteImages,
        clock
      ),
    access
  };
}

export type UsersModule = ReturnType<typeof createUsersModule>;
