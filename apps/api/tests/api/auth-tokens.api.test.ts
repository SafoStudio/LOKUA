import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/test-app.js';
import { AppError } from '../../src/common/errors/app-error.js';
import { getSetCookies } from '../helpers/get-set-cookies.js';

describe('Auth Tokens & /me API', () => {
  describe('POST /api/v1/auth/refresh', () => {
    it('returns 200 with user and refreshed cookies when valid refreshToken cookie is sent', async () => {
      const { app, mocks } = createTestApp();

      const mockUser = {
        id: 'usr-1',
        email: 'user@example.com',
        name: 'User',
        emailVerified: true
      };

      vi.mocked(mocks.refresh.execute).mockResolvedValueOnce({
        user: mockUser,
        accessToken: 'new.access.token',
        refreshToken: 'new.refresh.token'
      });

      const res = await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', ['refreshToken=valid-refresh-token']);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ user: mockUser });
      expect(mocks.refresh.execute).toHaveBeenCalledWith('valid-refresh-token');

      const cookies = getSetCookies(res);
      expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    });

    it('returns 401 when refreshToken cookie is missing', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/v1/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Refresh token required'
      });
    });

    it('returns 401 when refresh token is invalid or expired', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.refresh.execute).mockRejectedValueOnce(
          new AppError('Invalid refresh token', 401)
      );

      const res = await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', ['refreshToken=bad-refresh-token']);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Invalid refresh token'
      });
    });
  });

  describe('GET /api/v1/auth/me', () => {
    const mockUser = {
      id: 'usr-me-1',
      email: 'me@example.com',
      name: 'Me User',
      emailVerified: true
    };

    it('returns 200 with user when authenticated via accessToken cookie', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.tokenService.verifyAccessToken).mockResolvedValueOnce({ userId: 'usr-me-1' });
      vi.mocked(mocks.users.findById).mockResolvedValueOnce(mockUser);

      const res = await request(app)
          .get('/api/v1/auth/me')
          .set('Cookie', ['accessToken=valid-access-token']);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ user: mockUser });
    });

    it('returns 200 with user when authenticated via Bearer header', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.tokenService.verifyAccessToken).mockResolvedValueOnce({ userId: 'usr-me-1' });
      vi.mocked(mocks.users.findById).mockResolvedValueOnce(mockUser);

      const res = await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', 'Bearer bearer-token-123');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ user: mockUser });
    });

    it('returns 401 when no auth credentials provided', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Authentication required'
      });
    });

    it('returns 401 when access token is expired or invalid', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.tokenService.verifyAccessToken).mockRejectedValueOnce(new Error('expired'));

      const res = await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', 'Bearer expired-token');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Invalid or expired access token'
      });
    });
  });
});