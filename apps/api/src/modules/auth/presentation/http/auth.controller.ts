import type { Request, Response } from 'express';
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
  CompletePasskeyLoginUseCase
} from '../../application/index.js';
import { env } from '../../../../config/env.js';
import { AppError } from '../../../../common/errors/app-error.js';
import { assertString } from '../../../../common/errors/assert.js';
import { setAuthCookies, clearAuthCookies } from './cookies.js';
import {
  createGoogleState,
  setGoogleStateCookie,
  clearGoogleStateCookie,
  verifyGoogleState
} from './google.state.js';

interface AuthControllerDependencies {
  register: RegisterWithPasswordUseCase;
  login: LoginWithPasswordUseCase;
  loginGoogle: LoginWithGoogleUseCase;
  refresh: RefreshTokensUseCase;
  issueTokens: IssueAuthTokensUseCase;
  googleOAuth: GoogleOAuthProvider;
  startPasskeySignup: StartPasskeySignupUseCase;
  completePasskeySignup: CompletePasskeySignupUseCase;
  startPasskeyRegistration: StartPasskeyRegistrationUseCase;
  completePasskeyRegistration: CompletePasskeyRegistrationUseCase;
  startPasskeyLogin: StartPasskeyLoginUseCase;
  completePasskeyLogin: CompletePasskeyLoginUseCase;
}

export function createAuthController({
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
}: AuthControllerDependencies) {
  return {
    async registerWithPassword(req: Request, res: Response): Promise<void> {
      const user = await register.execute(req.body);
      const result = await issueTokens.execute(user);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(201).json({
        user: result.user
      });
    },

    async loginWithPassword(req: Request, res: Response): Promise<void> {
      const user = await login.execute(req.body);
      const result = await issueTokens.execute(user);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(200).json({
        user: result.user
      });
    },

    async startPasskeySignup(req: Request, res: Response): Promise<void> {
      const result = await startPasskeySignup.execute(req.body);

      res.status(200).json({
        options: result.options
      });
    },

    async completePasskeySignup(req: Request, res: Response): Promise<void> {
      const result = await completePasskeySignup.execute(req.body);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(201).json({
        user: result.user
      });
    },

    async startPasskeyRegistration(req: Request, res: Response): Promise<void> {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const result = await startPasskeyRegistration.execute({
        userId: req.user.id
      });

      res.status(200).json({
        options: result.options
      });
    },

    async completePasskeyRegistration(req: Request, res: Response): Promise<void> {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      await completePasskeyRegistration.execute({
        userId: req.user.id,
        challenge: req.body.challenge,
        response: req.body.response
      });

      res.status(201).json({
        message: 'Passkey registered successfully'
      });
    },

    async startPasskeyLogin(_req: Request, res: Response): Promise<void> {
      const result = await startPasskeyLogin.execute();

      res.status(200).json({
        options: result.options
      });
    },

    async completePasskeyLogin(req: Request, res: Response): Promise<void> {
      const result = await completePasskeyLogin.execute(req.body);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(200).json({
        user: result.user
      });
    },

    async refreshTokens(req: Request, res: Response): Promise<void> {
      const token = assertString(req.refreshToken, 'refresh token');

      const result = await refresh.execute(token);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(200).json({
        user: result.user
      });
    },

    logout(_req: Request, res: Response): void {
      clearAuthCookies(res);

      res.status(200).json({
        message: 'Logged out successfully'
      });
    },

    me(req: Request, res: Response): void {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      res.status(200).json({
        user: req.user
      });
    },

    googleStart(_req: Request, res: Response): void {
      const state = createGoogleState();

      setGoogleStateCookie(res, state);

      const url = googleOAuth.buildAuthUrl(state);

      res.redirect(url);
    },

    async googleCallback(req: Request, res: Response): Promise<void> {
      try {
        verifyGoogleState(req, req.query.state);

        const code = assertString(req.query.code, 'Google authorization code');

        const user = await loginGoogle.execute(code);
        const result = await issueTokens.execute(user);

        setAuthCookies(res, result.accessToken, result.refreshToken);

        res.redirect(env.GOOGLE_SUCCESS_REDIRECT);
      } finally {
        clearGoogleStateCookie(res);
      }
    }
  };
}

export type AuthController = ReturnType<typeof createAuthController>;
