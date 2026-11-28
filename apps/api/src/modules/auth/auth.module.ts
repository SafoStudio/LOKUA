import type { DataSource } from 'typeorm';
import type { AuthUserProvider, AccessService, UserProfileProvider } from '../users/index.js';
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
  LogoutAllUseCase,
  GetAuthUserProfileUseCase
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
import { createRequireRole } from './presentation/http/require-role.middleware.js';
import { createAuthRouter } from './presentation/http/auth.routes.js';
import { ChangeEmailUseCase } from './application/use-cases/change-email.use-case.js';
import { JwtEmailChangeTokens } from './infrastructure/crypto/email-change-tokens.js';
import { TypeOrmEmailChangeStore } from './infrastructure/persistence/adapters/email-change.store.js';
import { createEmailChangeRouter } from './presentation/http/email-change.routes.js';
import { createSharedAuthRateLimit } from './infrastructure/persistence/adapters/auth-rate-limit.js';
import { AccountEmailCodeUseCase } from './application/use-cases/account-email-code.use-case.js';
import { createReauthentication } from './presentation/http/reauthentication.js';
import { createAccountProofHandlers } from './presentation/http/account-proof.middleware.js';
import { createAccountDeletionRouter } from './presentation/http/account-deletion.routes.js';
import type { AccountDeletion } from './presentation/http/account-deletion.routes.js';
import { parseTtlToMs } from './application/use-cases/parse-ttl.js';
import { env } from '../../config/env.js';

interface CreateAuthModuleDependencies {
  dataSource: DataSource;
  users: AuthUserProvider;
  access: AccessService;
  profiles: UserProfileProvider;
}

export function createAuthModule({
  dataSource,
  users,
  access,
  profiles
}: CreateAuthModuleDependencies) {
  const roleMiddleware = createRequireRole();

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

  const registrationTransaction = new TypeOrmRegistrationTransaction(dataSource, users);
  const googleLoginTransaction = new TypeOrmGoogleLoginTransaction(dataSource, users);
  const passkeySignupTransaction = new TypeOrmPasskeySignupTransaction(dataSource, users);

  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService();
  const emailService = new BrevoEmailService();

  const googleOAuth = new GoogleOAuthProviderAdapter();
  const passkeyProvider = new SimpleWebAuthnVerificationProvider({
    rpId: env.WEBAUTHN_RP_ID,
    rpName: env.WEBAUTHN_RP_NAME,
    origin: env.WEBAUTHN_ORIGIN
  });

  const refreshTtlMs = parseTtlToMs(env.JWT_REFRESH_TTL);
  const issueTokens = new IssueAuthTokensUseCase(tokenService, refreshSessions, refreshTtlMs);

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

  const refresh = new RefreshTokensUseCase(
    users,
    tokenService,
    refreshSessions,
    securityEvents,
    refreshTtlMs
  );

  const requestPasswordReset = new RequestPasswordResetUseCase(
    users,
    passwordCredentials,
    passwordResetTokens,
    emailService,
    securityEvents
  );

  const resetPassword: Pick<ResetPasswordUseCase, 'execute'> = {
    execute: (input, context) =>
      dataSource.transaction(async (manager) => {
        const useCase = new ResetPasswordUseCase(
          new PasswordResetTokenRepositoryAdapter(manager.getRepository(PasswordResetTokenEntity)),
          new PasswordCredentialRepositoryAdapter(manager.getRepository(PasswordCredentialEntity)),
          passwordHasher,
          new RefreshSessionRepositoryAdapter(manager.getRepository(RefreshSessionEntity)),
          new SecurityEventRepositoryAdapter(manager.getRepository(SecurityEventEntity))
        );
        await useCase.execute(input, context);
      })
  };

  const changePassword: Pick<ChangePasswordUseCase, 'execute'> = {
    execute: (input, context) =>
      dataSource.transaction(async (manager) => {
        const useCase = new ChangePasswordUseCase(
          new PasswordCredentialRepositoryAdapter(manager.getRepository(PasswordCredentialEntity)),
          passwordHasher,
          new RefreshSessionRepositoryAdapter(manager.getRepository(RefreshSessionEntity)),
          new SecurityEventRepositoryAdapter(manager.getRepository(SecurityEventEntity))
        );
        await useCase.execute(input, context);
      })
  };

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
    securityEvents,
    sendVerificationEmail
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

  const getAuthUserProfile = new GetAuthUserProfileUseCase(profiles);

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
    completePasskeyLogin,
    getMyProfile: getAuthUserProfile
  });

  const middleware = createAuthMiddleware({
    tokenService,
    users,
    access
  });

  const rateLimit = createSharedAuthRateLimit(dataSource);
  const reauthenticate = createReauthentication(login, completePasskeyLogin);
  const enrollment = new AccountEmailCodeUseCase(
    passkeyChallenges,
    'ENROLLMENT_EMAIL',
    (to, code) =>
      emailService.sendNotificationEmail({
        to,
        title: 'Підтвердження додавання ключа доступу LOKUA',
        message: `Код підтвердження: ${code}. Він дійсний 10 хвилин.`
      })
  );
  const enrollmentHandlers = createAccountProofHandlers(enrollment, reauthenticate);
  const deletion = new AccountEmailCodeUseCase(passkeyChallenges, 'DELETION_EMAIL', (to, code) =>
    emailService.sendNotificationEmail({
      to,
      title: 'Підтвердження видалення акаунта LOKUA',
      message: `Код підтвердження видалення: ${code}. Він дійсний 10 хвилин.`
    })
  );
  const deletionProof = createAccountProofHandlers(deletion, reauthenticate);
  const router = createAuthRouter(
    controller,
    {
      ...middleware,
      authorizePasskeyEnrollment: enrollmentHandlers.authorize
    },
    rateLimit
  );
  router.post(
    '/passkey/registration/email-code',
    middleware.requireAuth,
    rateLimit('enrollment-email', 3, 15 * 60_000, (req) => req.user?.id ?? 'unknown'),
    enrollmentHandlers.requestCode
  );
  const changeEmail = new ChangeEmailUseCase(
    new TypeOrmEmailChangeStore(dataSource),
    new JwtEmailChangeTokens(env.JWT_REFRESH_SECRET),
    async (to, token) => {
      const url = new URL('/account/confirm-email', env.CLIENT_URL);
      url.hash = new URLSearchParams({ token }).toString();
      await emailService.sendNotificationEmail({
        to,
        title: 'Підтвердження нової email-адреси',
        message: `Підтвердьте нову email-адресу протягом години: ${url}`
      });
    },
    (to) =>
      emailService.sendNotificationEmail({
        to,
        title: 'Вашу email-адресу змінено',
        message:
          'Email-адресу вашого акаунта LOKUA змінено. Якщо це були не ви, зверніться до підтримки.'
      })
  );
  router.use(
    createEmailChangeRouter(
      middleware.requireAuth,
      changeEmail,
      login,
      completePasskeyLogin,
      rateLimit('change-email', 5, 15 * 60_000, (req) => req.user?.id ?? 'unknown')
    )
  );

  return {
    createAccountDeletionRouter: (accounts: AccountDeletion) =>
      createAccountDeletionRouter(middleware.requireAuth, accounts, {
        ...deletionProof,
        limitCode: rateLimit('deletion-code', 3, 15 * 60_000, (req) => req.user?.id ?? 'unknown'),
        limitProof: rateLimit('deletion-proof', 5, 15 * 60_000, (req) => req.user?.id ?? 'unknown'),
        limitRestore: rateLimit('account-restore', 20, 15 * 60_000)
      }),
    sendNotificationEmail: emailService.sendNotificationEmail.bind(emailService),
    router,
    access,
    requireAuth: middleware.requireAuth,
    optionalAuth: middleware.optionalAuth,
    requireRole: roleMiddleware.requireRole
  };
}

export type AuthModule = ReturnType<typeof createAuthModule>;
