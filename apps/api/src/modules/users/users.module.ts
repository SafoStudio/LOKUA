import type { DataSource } from 'typeorm';
import type { UserProvider, AuthUserProvider } from './application/index.js';
import { AccessService } from './application/index.js';
import {
  UserEntity,
  UserRepositoryAdapter,
  UserProviderAdapter,
  AuthUserProviderAdapter
} from './infrastructure/index.js';

interface CreateUsersModuleDependencies {
  dataSource: DataSource;
}

export function createUsersModule({ dataSource }: CreateUsersModuleDependencies) {
  const repository = new UserRepositoryAdapter(dataSource.getRepository(UserEntity));

  const users: UserProvider = new UserProviderAdapter(repository);
  const authUsers: AuthUserProvider = new AuthUserProviderAdapter(repository);
  const access = new AccessService();

  return {
    users,
    authUsers,
    access
  };
}

export type UsersModule = ReturnType<typeof createUsersModule>;
