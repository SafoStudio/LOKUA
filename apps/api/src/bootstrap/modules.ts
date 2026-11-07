import type { DataSource } from 'typeorm';
import { createUsersModule } from '../modules/users/index.js';
import { createAuthModule } from '../modules/auth/index.js';
import { createAuthUserProvider } from './auth-user-provider.js';

export function createModules(dataSource: DataSource) {
  const usersModule = createUsersModule(dataSource);

  const authModule = createAuthModule({
    dataSource,
    users: createAuthUserProvider(usersModule)
  });

  return {
    users: usersModule,
    auth: authModule
  };
}
