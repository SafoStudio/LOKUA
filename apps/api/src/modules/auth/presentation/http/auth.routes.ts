import { Router } from 'express';
import type { RequestHandler } from 'express';
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
}

export function createAuthRouter(controller: AuthController, middleware: AuthMiddleware) {
  const router = Router();
  const signupLimit = createRequestRateLimit({ limit: 10, windowMs: 60 * 60_000 });
  const loginLimit = createRequestRateLimit({ limit: 20, windowMs: 15 * 60_000 });

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

  router.post('/verify-email/resend', middleware.requireAuth, controller.resendVerificationEmail);

  router.post(
    '/password-reset/request',
    validate({ body: requestPasswordResetSchema }),
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
