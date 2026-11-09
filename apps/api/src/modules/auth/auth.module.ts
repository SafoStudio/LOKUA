import type { DataSource } from 'typeorm';
import type { UserProvider } from './application/index.js';
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
  CompletePasskeyLoginUseCase,
  SendVerificationEmailUseCase,
  VerifyEmailUseCase,
  RequestPasswordResetUseCase,
  ResetPasswordUseCase,
  ChangePasswordUseCase,
  LogoutUseCase,
  LogoutAllUseCase
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
  PasskeyChallengeEntity,
  TypeOrmRegistrationTransaction,
  TypeOrmGoogleLoginTransaction,
  TypeOrmPasskeySignupTransaction,
  EmailVerificationTokenEntity,
  EmailVerificationTokenRepositoryAdapter,
  BrevoEmailService,
  PasswordResetTokenEntity,
  PasswordResetTokenRepositoryAdapter,
  RefreshSessionEntity,
  RefreshSessionRepositoryAdapter,
  SecurityEventEntity,
  SecurityEventRepositoryAdapter
} from './infrastructure/index.js';

import { createAuthController } from './presentation/http/auth.controller.js';
import { createAuthMiddleware } from './presentation/http/auth.middleware.js';
import { createAuthRouter } from './presentation/http/auth.routes.js';
import { env } from '../../config/env.js';

interface CreateAuthModuleDependencies {
  dataSource: DataSource;
  users: UserProvider;
}

export function createAuthModule({ dataSource, users }: CreateAuthModuleDependencies) {
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

  const emailVerificationTokens = new EmailVerificationTokenRepositoryAdapter(
    dataSource.getRepository(EmailVerificationTokenEntity)
  );

  const passwordResetTokens = new PasswordResetTokenRepositoryAdapter(
    dataSource.getRepository(PasswordResetTokenEntity)
  );

  const refreshSessions = new RefreshSessionRepositoryAdapter(
    dataSource.getRepository(RefreshSessionEntity)
  );

  const securityEvents = new SecurityEventRepositoryAdapter(
    dataSource.getRepository(SecurityEventEntity)
  );

  const registrationTransaction = new TypeOrmRegistrationTransaction(dataSource);
  const googleLoginTransaction = new TypeOrmGoogleLoginTransaction(dataSource);
  const passkeySignupTransaction = new TypeOrmPasskeySignupTransaction(dataSource);

  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService();
  const emailService = new BrevoEmailService();

  const googleOAuth = new GoogleOAuthProviderAdapter();
  const passkeyProvider = new SimpleWebAuthnVerificationProvider({
    rpId: env.WEBAUTHN_RP_ID,
    rpName: env.WEBAUTHN_RP_NAME,
    origin: env.WEBAUTHN_ORIGIN
  });

  const issueTokens = new IssueAuthTokensUseCase(tokenService, refreshSessions);

  const sendVerificationEmail = new SendVerificationEmailUseCase(
    users,
    emailVerificationTokens,
    emailService
  );

  const verifyEmail = new VerifyEmailUseCase(emailVerificationTokens, users, securityEvents);

  const register = new RegisterWithPasswordUseCase(
    users,
    passwordHasher,
    registrationTransaction,
    sendVerificationEmail,
    securityEvents
  );

  const login = new LoginWithPasswordUseCase(
    users,
    passwordHasher,
    passwordCredentials,
    securityEvents
  );

  const loginGoogle = new LoginWithGoogleUseCase(
    users,
    googleOAuth,
    googleCredentials,
    googleLoginTransaction,
    securityEvents
  );

  const refresh = new RefreshTokensUseCase(users, tokenService, refreshSessions, securityEvents);

  const requestPasswordReset = new RequestPasswordResetUseCase(
    users,
    passwordCredentials,
    passwordResetTokens,
    emailService,
    securityEvents
  );

  const resetPassword = new ResetPasswordUseCase(
    passwordResetTokens,
    passwordCredentials,
    passwordHasher,
    refreshSessions,
    securityEvents
  );

  const changePassword = new ChangePasswordUseCase(
    passwordCredentials,
    passwordHasher,
    refreshSessions,
    securityEvents
  );

  const logout = new LogoutUseCase(refreshSessions, securityEvents);
  const logoutAll = new LogoutAllUseCase(refreshSessions, securityEvents);

  const startPasskeySignup = new StartPasskeySignupUseCase(
    users,
    passkeyChallenges,
    passkeyProvider
  );

  const completePasskeySignup = new CompletePasskeySignupUseCase(
    passkeyChallenges,
    passkeyProvider,
    passkeySignupTransaction,
    issueTokens,
    securityEvents
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
    issueTokens,
    securityEvents
  );

  const controller = createAuthController({
    register,
    login,
    loginGoogle,
    refresh,
    issueTokens,
    googleOAuth,
    sendVerificationEmail,
    verifyEmail,
    requestPasswordReset,
    resetPassword,
    changePassword,
    logout,
    logoutAll,
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
