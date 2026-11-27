export { createUsersModule } from './users.module.js';
export { AccountDeletionService } from './application/services/account-deletion.service.js';
export { TypeOrmAccountDeletionStore } from './infrastructure/persistence/adapters/account-deletion.store.js';
export { createUserBlocksRouter } from './presentation/http/user-blocks.routes.js';
export { createProfilePhotosRouter } from './presentation/http/profile-photos.routes.js';
export type { UsersModule } from './users.module.js';

export type { User, UserRole, UserStatus, AuthUser } from './domain/index.js';
export { calculateAge } from './domain/index.js';

export type { CreateUserData } from './application/index.js';
export type { UserProvider, AuthUserProvider } from './application/index.js';
export { AccessService } from './application/index.js';
export type { AgeRestriction } from '../../common/index.js';
export type { UserOnboardingProvider } from './application/index.js';

export type { UserProfile, UserProfileProvider } from './application/index.js';
export type { UserBlockProvider } from './application/ports/user-block.provider.js';
