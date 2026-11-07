import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware } from '../../../../src/modules/auth/presentation/http/auth.middleware.js';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE
} from '../../../../src/modules/auth/presentation/http/cookies.js';
import { AppError } from '../../../../src/common/errors/app-error.js';
import type { TokenService, UserProvider } from '../../../../src/modules/auth/application/index.js';

describe('auth.middleware', () => {
  const tokenService: TokenService = {
    signAccessToken: vi.fn(),
    signRefreshToken: vi.fn(),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn()
  };

  const users: UserProvider = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn()
  };

  const middleware = createAuthMiddleware({ tokenService, users });

  describe('requireAuth', () => {
    it('authenticates with valid cookie and attaches user to req', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        emailVerified: true
      };

      vi.mocked(tokenService.verifyAccessToken).mockResolvedValueOnce({ userId: 'user-1' });
      vi.mocked(users.findById).mockResolvedValueOnce(mockUser);

      const req = {
        headers: {},
        cookies: { [ACCESS_TOKEN_COOKIE]: 'valid-access-token' }
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      await middleware.requireAuth(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledWith();
    });

    it('authenticates with Bearer authorization header', async () => {
      const mockUser = {
        id: 'user-2',
        email: 'bearer@example.com',
        name: 'Bearer User',
        emailVerified: true
      };

      vi.mocked(tokenService.verifyAccessToken).mockResolvedValueOnce({ userId: 'user-2' });
      vi.mocked(users.findById).mockResolvedValueOnce(mockUser);

      const req = {
        headers: { authorization: 'Bearer header-access-token' },
        cookies: {}
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      await middleware.requireAuth(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledWith();
    });

    it('throws 401 when neither header nor cookie is present', async () => {
      const req = {
        headers: {},
        cookies: {}
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      await middleware.requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = (next as unknown as { mock: { calls: [[AppError]] } }).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Authentication required');
    });

    it('throws 401 when token verification fails', async () => {
      vi.mocked(tokenService.verifyAccessToken).mockRejectedValueOnce(new Error('jwt expired'));

      const req = {
        headers: {},
        cookies: { [ACCESS_TOKEN_COOKIE]: 'expired-token' }
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      await middleware.requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = (next as unknown as { mock: { calls: [[AppError]] } }).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Invalid or expired access token');
    });

    it('throws 401 when user not found in database', async () => {
      vi.mocked(tokenService.verifyAccessToken).mockResolvedValueOnce({ userId: 'non-existing' });
      vi.mocked(users.findById).mockResolvedValueOnce(null);

      const req = {
        headers: {},
        cookies: { [ACCESS_TOKEN_COOKIE]: 'token-for-deleted-user' }
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      await middleware.requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = (next as unknown as { mock: { calls: [[AppError]] } }).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('User not found');
    });
  });

  describe('requireRefreshToken', () => {
    it('extracts refresh token from cookies and attaches to req', () => {
      const req = {
        cookies: { [REFRESH_TOKEN_COOKIE]: 'refresh-token-value' }
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      middleware.requireRefreshToken(req, res, next);

      expect(req.refreshToken).toBe('refresh-token-value');
      expect(next).toHaveBeenCalledWith();
    });

    it('throws 401 when refresh token cookie is missing', () => {
      const req = {
        cookies: {}
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      middleware.requireRefreshToken(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = (next as unknown as { mock: { calls: [[AppError]] } }).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Refresh token required');
    });
  });
});
