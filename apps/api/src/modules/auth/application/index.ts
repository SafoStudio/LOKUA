export { RegisterWithPasswordUseCase } from './use-cases/register-with-password.use-case.js';
export type { RegisterWithPasswordInput } from './use-cases/register-with-password.use-case.js';

export { LoginWithPasswordUseCase } from './use-cases/login-with-password.use-case.js';
export type { LoginWithPasswordInput } from './use-cases/login-with-password.use-case.js';

export { LoginWithGoogleUseCase } from './use-cases/login-with-google.use-case.js';

export { RefreshTokensUseCase } from './use-cases/refresh-tokens.use-case.js';

export { IssueAuthTokensUseCase } from './use-cases/issue-auth-tokens.use-case.js';
export type { AuthResult } from './use-cases/issue-auth-tokens.use-case.js';

export { StartPasskeySignupUseCase } from './use-cases/start-passkey-signup.use-case.js';
export { CompletePasskeySignupUseCase } from './use-cases/complete-passkey-signup.use-case.js';

export { StartPasskeyRegistrationUseCase } from './use-cases/start-passkey-registration.use-case.js';
export { CompletePasskeyRegistrationUseCase } from './use-cases/complete-passkey-registration.use-case.js';

export { StartPasskeyLoginUseCase } from './use-cases/start-passkey-login.use-case.js';
export { CompletePasskeyLoginUseCase } from './use-cases/complete-passkey-login.use-case.js';

export type { UserProvider } from './ports/user.provider.js';
export type { RegistrationTransaction } from './ports/registration-transaction.js';
export type { GoogleLoginTransaction } from './ports/google-login-transaction.js';
export type { PasskeySignupTransaction } from './ports/passkey-signup-transaction.js';

export type { PasskeyChallengeRepository } from './ports/passkey-challenge.repository.js';

export type {
  PasskeyVerificationService,
  PasskeyCredentialData
} from './ports/passkey-verification.service.js';

export type {
  PasswordCredential,
  PasswordCredentialRepository
} from './ports/password-credential.repository.js';

export type {
  GoogleCredential,
  GoogleCredentialRepository
} from './ports/google-credential.repository.js';

export type {
  PasskeyCredential,
  PasskeyCredentialRepository
} from './ports/passkey-credential.repository.js';

export type { PasswordHasher } from './ports/password-hasher.js';
export type { TokenPayload, TokenService } from './ports/token.service.js';
export type { GoogleProfile, GoogleOAuthProvider } from './ports/google-oauth.provider.js';
