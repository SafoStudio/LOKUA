import type { UserProvider } from '../modules/auth/index.js';
import type { createUsersModule } from '../modules/users/index.js';

type UsersModule = ReturnType<typeof createUsersModule>;

export function createAuthUserProvider(users: UsersModule): UserProvider {
  const toAuthUser = (user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
  }) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified
  });

  return {
    async findById(id) {
      const user = await users.findById(id);
      return user ? toAuthUser(user) : null;
    },

    async findByEmail(email) {
      const user = await users.findByEmail(email);
      return user ? toAuthUser(user) : null;
    },

    async create(data) {
      const user = await users.createUser(data);
      return toAuthUser(user);
    }
  };
}
