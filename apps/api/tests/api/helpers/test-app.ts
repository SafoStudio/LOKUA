import { vi } from 'vitest';
import { createApp } from '../../../src/app.js';
import { createAuthController } from '../../../src/modules/auth/presentation/http/auth.controller.js';
import { createAuthMiddleware } from '../../../src/modules/auth/presentation/http/auth.middleware.js';
import { createAuthRouter } from '../../../src/modules/auth/presentation/http/auth.routes.js';
import type {
  RegisterWithPasswordUseCase,
  LoginWithPasswordUseCase,
  LoginWithGoogleUseCase,
  RefreshTokensUseCase,
  IssueAuthTokensUseCase,
  GoogleOAuthProvider,
  StartPasskeySignupUseCase,
  CompletePasskeySignupUseCase,
  StartPasskeyRegistrationUseCase,
  CompletePasskeyRegistrationUseCase,
  StartPasskeyLoginUseCase,
  CompletePasskeyLoginUseCase,
  TokenService,
  UserProvider
} from '../../../src/modules/auth/application/index.js';

export function createMockDependencies() {
  const register = {
    execute: vi.fn()
  } as unknown as RegisterWithPasswordUseCase;

  const login = {
    execute: vi.fn()
  } as unknown as LoginWithPasswordUseCase;

  const loginGoogle = {
    execute: vi.fn()
  } as unknown as LoginWithGoogleUseCase;

  const refresh = {
    execute: vi.fn()
  } as unknown as RefreshTokensUseCase;

  const issueTokens = {
    execute: vi.fn()
  } as unknown as IssueAuthTokensUseCase;

  const googleOAuth = {
    buildAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=true'),
    exchangeCode: vi.fn()
  } as unknown as GoogleOAuthProvider;

  const startPasskeySignup = {
    execute: vi.fn()
  } as unknown as StartPasskeySignupUseCase;

  const completePasskeySignup = {
    execute: vi.fn()
  } as unknown as CompletePasskeySignupUseCase;

  const startPasskeyRegistration = {
    execute: vi.fn()
  } as unknown as StartPasskeyRegistrationUseCase;

  const completePasskeyRegistration = {
    execute: vi.fn()
  } as unknown as CompletePasskeyRegistrationUseCase;

  const startPasskeyLogin = {
    execute: vi.fn()
  } as unknown as StartPasskeyLoginUseCase;

  const completePasskeyLogin = {
    execute: vi.fn()
  } as unknown as CompletePasskeyLoginUseCase;

  const tokenService = {
    signAccessToken: vi.fn(),
    signRefreshToken: vi.fn(),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn()
  } as unknown as TokenService;

  const users = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn()
  } as unknown as UserProvider;

  return {
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
    completePasskeyLogin,
    tokenService,
    users
  };
}

export function createTestApp(mocks = createMockDependencies()) {
  const controller = createAuthController({
    register: mocks.register,
    login: mocks.login,
    loginGoogle: mocks.loginGoogle,
    refresh: mocks.refresh,
    issueTokens: mocks.issueTokens,
    googleOAuth: mocks.googleOAuth,
    startPasskeySignup: mocks.startPasskeySignup,
    completePasskeySignup: mocks.completePasskeySignup,
    startPasskeyRegistration: mocks.startPasskeyRegistration,
    completePasskeyRegistration: mocks.completePasskeyRegistration,
    startPasskeyLogin: mocks.startPasskeyLogin,
    completePasskeyLogin: mocks.completePasskeyLogin
  });

  const middleware = createAuthMiddleware({
    tokenService: mocks.tokenService,
    users: mocks.users
  });

  const authRouter = createAuthRouter(controller, middleware);
  const app = createApp({ authRouter });

  return { app, mocks };
}
