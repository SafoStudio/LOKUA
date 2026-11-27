import type { DataSource } from 'typeorm';
import type {
  UserProvider,
  AuthUserProvider,
  UserOnboardingProvider,
  UserProfileProvider
} from './application/index.js';
import { AccessService } from './application/index.js';
import { UserBlockService } from './application/services/user-block.service.js';
import { UserPhotoProviderAdapter } from './infrastructure/persistence/adapters/user-photo.provider.adapter.js';
import {
  UserEntity,
  UserBlockEntity,
  UserBlockProviderAdapter,
  UserRepositoryAdapter,
  UserProviderAdapter,
  AuthUserProviderAdapter,
  UserOnboardingProviderAdapter,
  UserProfileProviderAdapter
} from './infrastructure/index.js';

interface CreateUsersModuleDependencies {
  dataSource: DataSource;
}

export function createUsersModule({ dataSource }: CreateUsersModuleDependencies) {
  const repository = new UserRepositoryAdapter(dataSource.getRepository(UserEntity));

  const users: UserProvider = new UserProviderAdapter(repository);
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
    photos: new UserPhotoProviderAdapter(dataSource),
    blocks,
    blockSettings: new UserBlockService(blocks),
    access
  };
}

export type UsersModule = ReturnType<typeof createUsersModule>;
