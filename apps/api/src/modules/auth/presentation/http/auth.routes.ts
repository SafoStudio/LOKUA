import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import { validate } from '../../../../middlewares/index.js';
import { createRequestRateLimit } from '../../../../middlewares/request-rate-limit.js';
import {
  registerSchema,
  loginSchema,
  passkeySignupOptionsSchema,
  passkeySignupVerifySchema,
  passkeyRegistrationVerifySchema,
  passkeyLoginVerifySchema,
  verifyEmailSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  changePasswordSchema
} from './auth.schema.js';
import type { AuthController } from './auth.controller.js';

interface AuthMiddleware {
  requireAuth: RequestHandler;
  requireRefreshToken: RequestHandler;
  authorizePasskeyEnrollment: RequestHandler;
}

export type AuthRateLimit = (
  scope: string,
  limit: number,
  windowMs: number,
  key?: (request: Request) => string
) => RequestHandler;

export function createAuthRouter(
  controller: AuthController,
  middleware: AuthMiddleware,
  rateLimit: AuthRateLimit = (_scope, limit, windowMs, key) =>
    createRequestRateLimit({ limit, windowMs, key })
) {
  const router = Router();
  const signupLimit = rateLimit('signup', 10, 60 * 60_000);
  const loginLimit = rateLimit('login', 20, 15 * 60_000);
  const mailWindowMs = 15 * 60_000;
  const resetIpLimit = rateLimit('reset-ip', 10, mailWindowMs);
  const resetEmailLimit = rateLimit('reset-email', 3, mailWindowMs, (req) =>
    (req.body.email as string).trim().toLowerCase()
  );
  const resendLimit = rateLimit('resend', 3, mailWindowMs, (req) => req.user?.id ?? 'unknown');
  const resendIpLimit = rateLimit('resend-ip', 10, mailWindowMs);

  router.post(
    '/register',
    signupLimit,
    validate({ body: registerSchema }),
    controller.registerWithPassword
  );

  router.post('/login', loginLimit, validate({ body: loginSchema }), controller.loginWithPassword);

  router.post('/refresh', middleware.requireRefreshToken, controller.refreshTokens);

  router.post('/logout', controller.logout);

  router.post('/logout-all', middleware.requireAuth, controller.logoutAll);

  router.get('/me', middleware.requireAuth, controller.me);

  router.get('/google', loginLimit, controller.googleStart);

  router.get('/google/callback', loginLimit, controller.googleCallback);

  router.get('/verify-email', validate({ query: verifyEmailSchema }), controller.verifyEmail);

  router.post(
    '/verify-email/resend',
    middleware.requireAuth,
    resendIpLimit,
    resendLimit,
    controller.resendVerificationEmail
  );

  router.post(
    '/password-reset/request',
    resetIpLimit,
    validate({ body: requestPasswordResetSchema }),
    resetEmailLimit,
    controller.requestPasswordReset
  );

  router.post('/password-reset', validate({ body: resetPasswordSchema }), controller.resetPassword);

  router.post(
    '/change-password',
    middleware.requireAuth,
    validate({ body: changePasswordSchema }),
    controller.changePassword
  );

  router.post(
    '/passkey/signup/options',
    signupLimit,
    validate({ body: passkeySignupOptionsSchema }),
    controller.startPasskeySignup
  );

  router.post(
    '/passkey/signup/verify',
    signupLimit,
    validate({ body: passkeySignupVerifySchema }),
    controller.completePasskeySignup
  );

  router.post(
    '/passkey/registration/options',
    middleware.requireAuth,
    rateLimit('enrollment-proof', 8, mailWindowMs, (req) => req.user?.id ?? 'unknown'),
    middleware.authorizePasskeyEnrollment,
    controller.startPasskeyRegistration
  );

  router.post(
    '/passkey/registration/verify',
    middleware.requireAuth,
    validate({ body: passkeyRegistrationVerifySchema }),
    controller.completePasskeyRegistration
  );

  router.post('/passkey/login/options', loginLimit, controller.startPasskeyLogin);

  router.post(
    '/passkey/login/verify',
    loginLimit,
    validate({ body: passkeyLoginVerifySchema }),
    controller.completePasskeyLogin
  );

  return router;
}
