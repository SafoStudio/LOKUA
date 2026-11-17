export type { CreateUserData } from './types/create-user-data.js';

export type { UserRepository } from './ports/user.repository.js';
export type { UserProvider } from './ports/user.provider.js';
export type { AuthUserProvider } from './ports/auth-user.provider.js';
export type { UserOnboardingProvider } from './ports/user-onboarding.provider.js';

export { CreateUserUseCase } from './use-cases/create-user.use-case.js';
export { FindUserByIdUseCase } from './use-cases/find-user-by-id.use-case.js';
export { FindUserByEmailUseCase } from './use-cases/find-user-by-email.use-case.js';
export { MarkEmailVerifiedUseCase } from './use-cases/mark-email-verified.use-case.js';

export { AccessService } from './services/access.service.js';
export type { AgeRestriction } from './services/access.service.js';
