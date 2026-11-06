import type { DataSource } from 'typeorm';
import { createUsersModule } from '../modules/users/index.js';
import { createAuthModule } from '../modules/auth/index.js';
import type { UserProvider } from '../modules/auth/index.js';
import { TypeOrmRegistrationTransaction } from './typeorm-registration.transaction.js';
import { TypeOrmGoogleLoginTransaction } from './typeorm-google-login.transaction.js';
import { TypeOrmPasskeySignupTransaction } from './typeorm-passkey-signup.transaction.js';

export function createModules(dataSource: DataSource) {
  const usersModule = createUsersModule(dataSource);

  const authUserProvider: UserProvider = {
    async findById(id) {
      const user = await usersModule.findById(id);

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified
      };
    },

    async findByEmail(email) {
      const user = await usersModule.findByEmail(email);

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified
      };
    },

    async create(data) {
      const user = await usersModule.createUser(data);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified
      };
    }
  };

  const registrationTransaction = new TypeOrmRegistrationTransaction(dataSource);
  const googleLoginTransaction = new TypeOrmGoogleLoginTransaction(dataSource);
  const passkeySignupTransaction = new TypeOrmPasskeySignupTransaction(dataSource);

  const authModule = createAuthModule({
    dataSource,
    users: authUserProvider,
    registrationTransaction,
    googleLoginTransaction,
    passkeySignupTransaction
  });

  return {
    users: usersModule,
    auth: authModule
  };
}
