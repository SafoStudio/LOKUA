import type { DataSource } from 'typeorm';
import type {
  RegistrationTransaction,
  GoogleLoginTransaction,
  PasskeySignupTransaction,
  UserProvider
} from './application/index.js';

import {
  RegisterWithPasswordUseCase,
  LoginWithPasswordUseCase,
  LoginWithGoogleUseCase,
  RefreshTokensUseCase,
  IssueAuthTokensUseCase,
  StartPasskeySignupUseCase,
  CompletePasskeySignupUseCase,
  StartPasskeyRegistrationUseCase,
  CompletePasskeyRegistrationUseCase,
  StartPasskeyLoginUseCase,
  CompletePasskeyLoginUseCase
} from './application/index.js';

import {
  PasswordCredentialRepositoryAdapter,
  GoogleCredentialRepositoryAdapter,
  PasskeyCredentialRepositoryAdapter,
  PasskeyChallengeRepositoryAdapter,
  BcryptPasswordHasher,
  JwtTokenService,
  GoogleOAuthProviderAdapter,
  SimpleWebAuthnVerificationProvider,
  PasswordCredentialEntity,
  GoogleCredentialEntity,
  PasskeyCredentialEntity,
  PasskeyChallengeEntity
} from './infrastructure/index.js';

import { createAuthController } from './presentation/http/auth.controller.js';
import { createAuthMiddleware } from './presentation/http/auth.middleware.js';
import { createAuthRouter } from './presentation/http/auth.routes.js';
import { env } from '../../config/env.js';

interface CreateAuthModuleDependencies {
  dataSource: DataSource;
  users: UserProvider;
  registrationTransaction: RegistrationTransaction;
  googleLoginTransaction: GoogleLoginTransaction;
  passkeySignupTransaction: PasskeySignupTransaction;
}

export function createAuthModule({
  dataSource,
  users,
  registrationTransaction,
  googleLoginTransaction,
  passkeySignupTransaction
}: CreateAuthModuleDependencies) {
  const passwordCredentials = new PasswordCredentialRepositoryAdapter(
    dataSource.getRepository(PasswordCredentialEntity)
  );

  const googleCredentials = new GoogleCredentialRepositoryAdapter(
    dataSource.getRepository(GoogleCredentialEntity)
  );

  const passkeyCredentials = new PasskeyCredentialRepositoryAdapter(
    dataSource.getRepository(PasskeyCredentialEntity)
  );

  const passkeyChallenges = new PasskeyChallengeRepositoryAdapter(
    dataSource.getRepository(PasskeyChallengeEntity)
  );

  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService();

  const googleOAuth = new GoogleOAuthProviderAdapter();
  const passkeyProvider = new SimpleWebAuthnVerificationProvider({
    rpId: env.WEBAUTHN_RP_ID,
    rpName: env.WEBAUTHN_RP_NAME,
    origin: env.WEBAUTHN_ORIGIN
  });

  const issueTokens = new IssueAuthTokensUseCase(tokenService);

  const register = new RegisterWithPasswordUseCase(users, passwordHasher, registrationTransaction);

  const login = new LoginWithPasswordUseCase(users, passwordHasher, passwordCredentials);

  const loginGoogle = new LoginWithGoogleUseCase(
    users,
    googleOAuth,
    googleCredentials,
    googleLoginTransaction
  );

  const refresh = new RefreshTokensUseCase(users, tokenService);

  const startPasskeySignup = new StartPasskeySignupUseCase(
    users,
    passkeyChallenges,
    passkeyProvider
  );

  const completePasskeySignup = new CompletePasskeySignupUseCase(
    passkeyChallenges,
    passkeyProvider,
    passkeySignupTransaction,
    issueTokens
  );

  const startPasskeyRegistration = new StartPasskeyRegistrationUseCase(
    users,
    passkeyCredentials,
    passkeyChallenges,
    passkeyProvider
  );

  const completePasskeyRegistration = new CompletePasskeyRegistrationUseCase(
    passkeyChallenges,
    passkeyCredentials,
    passkeyProvider
  );

  const startPasskeyLogin = new StartPasskeyLoginUseCase(passkeyChallenges, passkeyProvider);

  const completePasskeyLogin = new CompletePasskeyLoginUseCase(
    users,
    passkeyChallenges,
    passkeyCredentials,
    passkeyProvider,
    issueTokens
  );

  const controller = createAuthController({
    register,
    login,
    loginGoogle,
    refresh,
    issueTokens,
    googleOAuth,
    startPasskeySignup,
    completePasskeySignup,
    startPasskeyRegistration,
    completePasskeyRegistration,
    startPasskeyLogin,
    completePasskeyLogin
  });

  const middleware = createAuthMiddleware({
    tokenService,
    users
  });

  const router = createAuthRouter(controller, middleware);

  return { router };
}

export type AuthModule = ReturnType<typeof createAuthModule>;
