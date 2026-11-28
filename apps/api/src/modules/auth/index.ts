export { createAuthModule } from './auth.module.js';
export { requireTrustedCookieOrigin } from './presentation/http/cookie-origin.middleware.js';
export type { AuthModule } from './auth.module.js';
export { createAccountRecoveryLink } from './presentation/http/account-deletion.routes.js';

export type { AuthUserProvider } from '../users/index.js';
