export { createUsersModule } from './users.module.js';
export type { UsersModule } from './users.module.js';

export type { User, UserRole, UserStatus, AuthUser } from './domain/index.js';
export { calculateAge } from './domain/index.js';

export type { CreateUserData } from './application/index.js';
export type { UserProvider, AuthUserProvider } from './application/index.js';
export { AccessService } from './application/index.js';
export type { AgeRestriction } from './application/index.js';
