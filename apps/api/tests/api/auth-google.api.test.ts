import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/test-app.js';
import { env } from '../../src/config/env.js';
import { AppError } from '../../src/common/index.js';
import { getSetCookies } from '../helpers/get-set-cookies.js';

describe('Google OAuth API', () => {
  describe('GET /api/v1/auth/google', () => {
    it('redirects to Google OAuth URL and sets state cookie', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.googleOAuth.buildAuthUrl).mockReturnValueOnce(
          'https://accounts.google.com/o/oauth2/v2/auth?client_id=mock'
      );

      const res = await request(app).get('/api/v1/auth/google');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
          'https://accounts.google.com/o/oauth2/v2/auth?client_id=mock'
      );

      const cookies = getSetCookies(res);
      expect(cookies.length).toBeGreaterThan(0);

      const stateCookie = cookies.find((c) => c.startsWith('googleOAuthState='));
      expect(stateCookie).toBeDefined();
      expect(stateCookie).toContain('HttpOnly');
      expect(stateCookie).toContain('Path=/api/v1/auth/google');
    });
  });

  describe('GET /api/v1/auth/google/callback', () => {
    it('verifies state, logs user in, sets auth cookies, clears state and redirects to success URL', async () => {
      const { app, mocks } = createTestApp();

      const stateValue = 'a'.repeat(64);
      const code = 'valid-google-code-123';

      const mockUser = {
        id: 'usr-google-1',
        email: 'googleuser@gmail.com',
        name: 'Google User',
        emailVerified: true
      };

      vi.mocked(mocks.loginGoogle.execute).mockResolvedValueOnce(mockUser);
      vi.mocked(mocks.issueTokens.execute).mockResolvedValueOnce({
        user: mockUser,
        accessToken: 'access.google.token',
        refreshToken: 'refresh.google.token'
      });

      const res = await request(app)
          .get(`/api/v1/auth/google/callback?code=${code}&state=${stateValue}`)
          .set('Cookie', [`googleOAuthState=${stateValue}`]);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(env.GOOGLE_SUCCESS_REDIRECT);

      const cookies = getSetCookies(res);
      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);

      const clearedStateCookie = cookies.find((c) => c.includes('googleOAuthState=;'));
      expect(clearedStateCookie).toBeDefined();
    });

    it('returns 400 when OAuth state does not match cookie', async () => {
      const { app } = createTestApp();

      const res = await request(app)
          .get('/api/v1/auth/google/callback?code=some-code&state=bad-state')
          .set('Cookie', [`googleOAuthState=${'a'.repeat(64)}`]);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Invalid OAuth state'
      });

      const cookies = getSetCookies(res);
      expect(cookies.some((c) => c.includes('googleOAuthState=;'))).toBe(true);
    });

    it('returns 400 when code is missing from callback query', async () => {
      const { app } = createTestApp();

      const stateValue = 'b'.repeat(64);
      const res = await request(app)
          .get(`/api/v1/auth/google/callback?state=${stateValue}`)
          .set('Cookie', [`googleOAuthState=${stateValue}`]);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('returns 409 when user with this email already registered via password', async () => {
      const { app, mocks } = createTestApp();

      const stateValue = 'c'.repeat(64);

      vi.mocked(mocks.loginGoogle.execute).mockRejectedValueOnce(
          new AppError(
              'Email already registered. Log in with password and link Google in settings.',
              409
          )
      );

      const res = await request(app)
          .get(`/api/v1/auth/google/callback?code=some-code&state=${stateValue}`)
          .set('Cookie', [`googleOAuthState=${stateValue}`]);

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Email already registered. Log in with password and link Google in settings.'
      });
    });
  });
});