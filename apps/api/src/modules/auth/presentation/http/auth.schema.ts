import { z } from 'zod';

const passkeyResponseSchema = z.looseObject({
  id: z.string().min(1)
});

export const registerSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(72)
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(72)
});

export const passkeySignupOptionsSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(100)
});

export const passkeySignupVerifySchema = z.object({
  challenge: z.string().min(1),
  response: passkeyResponseSchema
});

export const passkeyRegistrationVerifySchema = z.object({
  challenge: z.string().min(1),
  response: passkeyResponseSchema
});

export const passkeyLoginVerifySchema = z.object({
  challenge: z.string().min(1),
  response: passkeyResponseSchema
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1)
});

export const requestPasswordResetSchema = z.object({
  email: z.email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(72)
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72)
});
