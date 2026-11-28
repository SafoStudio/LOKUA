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
  CompletePasskeyLoginUseCase,
  SendVerificationEmailUseCase,
  VerifyEmailUseCase,
  RequestPasswordResetUseCase,
  ResetPasswordUseCase,
  ChangePasswordUseCase,
  LogoutUseCase,
  LogoutAllUseCase
} from '../../application/index.js';
import type { UserProfile } from '../../../users/index.js';
import { env } from '../../../../config/env.js';
import { AppError, assertString } from '../../../../common/index.js';
import { setAuthCookies, clearAuthCookies, REFRESH_TOKEN_COOKIE } from './cookies.js';
import { toSecurityContext } from './security-context.js';
import {
  createGoogleState,
  setGoogleStateCookie,
  clearGoogleStateCookie,
  requireGoogleVerifier,
  setGoogleVerifierCookie,
  verifyGoogleState
} from './google.state.js';
import { toUserProfileView } from './user-profile.view.js';

export interface GetMyProfileUseCase {
  execute(userId: string): Promise<UserProfile>;
}

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
  sendVerificationEmail: SendVerificationEmailUseCase;
  verifyEmail: VerifyEmailUseCase;
  requestPasswordReset: RequestPasswordResetUseCase;
  resetPassword: Pick<ResetPasswordUseCase, 'execute'>;
  changePassword: Pick<ChangePasswordUseCase, 'execute'>;
  logout: LogoutUseCase;
  logoutAll: LogoutAllUseCase;
  getMyProfile: GetMyProfileUseCase;
}

function requireUserId(req: Request): string {
  if (!req.user) throw new AppError('Authentication required', 401);
  return req.user.id;
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
  completePasskeyLogin,
  sendVerificationEmail,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
  logout,
  logoutAll,
  getMyProfile
}: AuthControllerDependencies) {
  return {
    async registerWithPassword(req: Request, res: Response): Promise<void> {
      const user = await register.execute(req.body, toSecurityContext(req));
      const result = await issueTokens.execute(user);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(201).json({
        user: result.user
      });
    },

    async loginWithPassword(req: Request, res: Response): Promise<void> {
      const user = await login.execute(req.body, toSecurityContext(req));
      const result = await issueTokens.execute(user);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(200).json({ user: result.user });
    },

    async startPasskeySignup(req: Request, res: Response): Promise<void> {
      const result = await startPasskeySignup.execute(req.body);

      res.status(200).json({ options: result.options });
    },

    async completePasskeySignup(req: Request, res: Response): Promise<void> {
      const result = await completePasskeySignup.execute(req.body, toSecurityContext(req));

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(201).json({ user: result.user });
    },

    async startPasskeyRegistration(req: Request, res: Response): Promise<void> {
      const result = await startPasskeyRegistration.execute({ userId: requireUserId(req) });

      res.status(200).json({ options: result.options });
    },

    async completePasskeyRegistration(req: Request, res: Response): Promise<void> {
      await completePasskeyRegistration.execute({
        userId: requireUserId(req),
        challenge: req.body.challenge,
        response: req.body.response
      });

      res.status(201).json({ message: 'Passkey registered successfully' });
    },

    async startPasskeyLogin(_req: Request, res: Response): Promise<void> {
      const result = await startPasskeyLogin.execute();

      res.status(200).json({ options: result.options });
    },

    async completePasskeyLogin(req: Request, res: Response): Promise<void> {
      const result = await completePasskeyLogin.execute(req.body, toSecurityContext(req));

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(200).json({ user: result.user });
    },

    async refreshTokens(req: Request, res: Response): Promise<void> {
      const token = assertString(req.refreshToken, 'refresh token');

      const result = await refresh.execute(token, toSecurityContext(req));

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(200).json({ user: result.user });
    },

    async logout(req: Request, res: Response): Promise<void> {
      await logout.execute(req.cookies?.[REFRESH_TOKEN_COOKIE], toSecurityContext(req));

      clearAuthCookies(res);

      res.status(200).json({ message: 'Logged out successfully' });
    },

    async logoutAll(req: Request, res: Response): Promise<void> {
      await logoutAll.execute(requireUserId(req), toSecurityContext(req));

      clearAuthCookies(res);

      res.status(200).json({ message: 'Logged out from all devices' });
    },

    async me(req: Request, res: Response): Promise<void> {
      const profile = await getMyProfile.execute(requireUserId(req));

      res.status(200).json({ user: toUserProfileView(profile, req.user?.emailVerified === true) });
    },

    async verifyEmail(req: Request, res: Response): Promise<void> {
      const token = assertString(req.query.token, 'Verification token');

      await verifyEmail.execute(token, toSecurityContext(req));

      res.status(200).json({ message: 'Email verified successfully' });
    },

    async resendVerificationEmail(req: Request, res: Response): Promise<void> {
      await sendVerificationEmail.execute(requireUserId(req));

      res.status(200).json({ message: 'Verification email sent' });
    },

    async requestPasswordReset(req: Request, res: Response): Promise<void> {
      await requestPasswordReset.execute(req.body.email, toSecurityContext(req));

      res.status(200).json({ message: 'If the email exists, a password reset link has been sent' });
    },

    async resetPassword(req: Request, res: Response): Promise<void> {
      await resetPassword.execute(
        {
          token: req.body.token,
          password: req.body.password
        },
        toSecurityContext(req)
      );

      res.status(200).json({ message: 'Password reset successfully' });
    },

    async changePassword(req: Request, res: Response): Promise<void> {
      await changePassword.execute(
        {
          userId: requireUserId(req),
          currentPassword: req.body.currentPassword,
          newPassword: req.body.newPassword
        },
        toSecurityContext(req)
      );

      res.status(200).json({ message: 'Password changed successfully' });
    },

    googleStart(req: Request, res: Response): void {
      const state = createGoogleState(req.query.termsAccepted === 'true');

      setGoogleStateCookie(res, state);

      const url = googleOAuth.buildAuthUrl(state, setGoogleVerifierCookie(res));

      res.redirect(url);
    },

    async googleCallback(req: Request, res: Response): Promise<void> {
      try {
        verifyGoogleState(req, req.query.state);

        const code = assertString(req.query.code, 'Google authorization code');

        const state = assertString(req.query.state, 'Google OAuth state');
        const user = await loginGoogle.execute(
          code,
          toSecurityContext(req),
          state.startsWith('consent.'),
          requireGoogleVerifier(req)
        );
        const result = await issueTokens.execute(user);

        setAuthCookies(res, result.accessToken, result.refreshToken);

        clearGoogleStateCookie(res);
        res.redirect(env.GOOGLE_SUCCESS_REDIRECT);
      } catch (err) {
        clearGoogleStateCookie(res);
        throw err;
      }
    }
  };
}

export type AuthController = ReturnType<typeof createAuthController>;
