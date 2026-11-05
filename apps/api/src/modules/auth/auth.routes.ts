import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../middlewares/async-handler.js';
import { registerSchema, loginSchema } from './auth.schema.js';
import { requireAuth, requireRefreshToken } from './auth.middleware.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  validate({ body: registerSchema }),
  asyncHandler(authController.register)
);
authRouter.post('/login', validate({ body: loginSchema }), asyncHandler(authController.login));
authRouter.post('/refresh', requireRefreshToken, asyncHandler(authController.refresh));
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);
authRouter.get('/google', authController.googleStart);
authRouter.get('/google/callback', asyncHandler(authController.googleCallback));
