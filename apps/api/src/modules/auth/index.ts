export { createAuthModule } from './auth.module.js';
export type { AuthModule } from './auth.module.js';
export {
  createAccountDeletionRouter,
  createAccountRecoveryLink
} from './presentation/http/account-deletion.routes.js';

export type { AuthUserProvider } from '../users/index.js';
