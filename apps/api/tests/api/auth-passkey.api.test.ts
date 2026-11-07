import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/test-app.js';
import { AppError } from '../../src/common/errors/app-error.js';
import { getSetCookies } from '../helpers/get-set-cookies.js';

describe('Passkey API Endpoints', () => {
  describe('Passkey Signup Flow', () => {
    it('POST /api/v1/auth/passkey/signup/options returns 200 with options', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.startPasskeySignup.execute).mockResolvedValueOnce({
        options: { challenge: 'signup-challenge-xyz', rp: { name: 'LOKUA' } }
      });

      const res = await request(app).post('/api/v1/auth/passkey/signup/options').send({
        email: 'dave@example.com',
        name: 'Dave'
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        options: { challenge: 'signup-challenge-xyz', rp: { name: 'LOKUA' } }
      });
      expect(mocks.startPasskeySignup.execute).toHaveBeenCalledWith({
        email: 'dave@example.com',
        name: 'Dave'
      });
    });

    it('POST /api/v1/auth/passkey/signup/options returns 409 if email already exists', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.startPasskeySignup.execute).mockRejectedValueOnce(
          new AppError('Email already registered', 409)
      );

      const res = await request(app).post('/api/v1/auth/passkey/signup/options').send({
        email: 'existing@example.com',
        name: 'Existing'
      });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Email already registered'
      });
    });

    it('POST /api/v1/auth/passkey/signup/verify returns 201 with user and auth cookies', async () => {
      const { app, mocks } = createTestApp();

      const mockUser = {
        id: 'usr-passkey-1',
        email: 'dave@example.com',
        name: 'Dave',
        emailVerified: true
      };

      vi.mocked(mocks.completePasskeySignup.execute).mockResolvedValueOnce({
        user: mockUser,
        accessToken: 'passkey.access.jwt',
        refreshToken: 'passkey.refresh.jwt'
      });

      const res = await request(app)
          .post('/api/v1/auth/passkey/signup/verify')
          .send({
            challenge: 'signup-challenge-xyz',
            response: {
              id: 'cred-id-abc',
              rawId: 'cred-id-abc',
              response: { clientDataJSON: 'xyz' },
              type: 'public-key'
            }
          });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ user: mockUser });

      const cookies = getSetCookies(res);
      expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    });

    it('POST /api/v1/auth/passkey/signup/verify returns 400 on invalid challenge/verification', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.completePasskeySignup.execute).mockRejectedValueOnce(
          new AppError('Passkey verification failed', 400)
      );

      const res = await request(app)
          .post('/api/v1/auth/passkey/signup/verify')
          .send({
            challenge: 'bad-challenge',
            response: { id: 'bad-cred-id' }
          });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Passkey verification failed'
      });
    });
  });

  describe('Passkey Registration Flow (adding credential to existing account)', () => {
    const authUser = {
      id: 'existing-usr-88',
      email: 'member@example.com',
      name: 'Member',
      emailVerified: true
    };

    it('POST /api/v1/auth/passkey/registration/options returns 200 with options for authenticated user', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.tokenService.verifyAccessToken).mockResolvedValueOnce({
        userId: authUser.id
      });
      vi.mocked(mocks.users.findById).mockResolvedValueOnce(authUser);
      vi.mocked(mocks.startPasskeyRegistration.execute).mockResolvedValueOnce({
        options: { challenge: 'reg-opt-ch' }
      });

      const res = await request(app)
          .post('/api/v1/auth/passkey/registration/options')
          .set('Cookie', ['accessToken=valid-access-token']);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ options: { challenge: 'reg-opt-ch' } });
      expect(mocks.startPasskeyRegistration.execute).toHaveBeenCalledWith({
        userId: authUser.id
      });
    });

    it('POST /api/v1/auth/passkey/registration/options returns 401 when not authenticated', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/v1/auth/passkey/registration/options');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    });

    it('POST /api/v1/auth/passkey/registration/verify returns 201 with success message', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.tokenService.verifyAccessToken).mockResolvedValueOnce({
        userId: authUser.id
      });
      vi.mocked(mocks.users.findById).mockResolvedValueOnce(authUser);
      vi.mocked(mocks.completePasskeyRegistration.execute).mockResolvedValueOnce();

      const res = await request(app)
          .post('/api/v1/auth/passkey/registration/verify')
          .set('Cookie', ['accessToken=valid-access-token'])
          .send({
            challenge: 'reg-opt-ch',
            response: { id: 'new-cred-123' }
          });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ message: 'Passkey registered successfully' });
      expect(mocks.completePasskeyRegistration.execute).toHaveBeenCalledWith({
        userId: authUser.id,
        challenge: 'reg-opt-ch',
        response: { id: 'new-cred-123' }
      });
    });

    it('POST /api/v1/auth/passkey/registration/verify returns 409 when passkey already registered', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.tokenService.verifyAccessToken).mockResolvedValueOnce({
        userId: authUser.id
      });
      vi.mocked(mocks.users.findById).mockResolvedValueOnce(authUser);
      vi.mocked(mocks.completePasskeyRegistration.execute).mockRejectedValueOnce(
          new AppError('Passkey already registered', 409)
      );

      const res = await request(app)
          .post('/api/v1/auth/passkey/registration/verify')
          .set('Cookie', ['accessToken=valid-access-token'])
          .send({
            challenge: 'reg-opt-ch',
            response: { id: 'duplicate-cred' }
          });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Passkey already registered');
    });
  });

  describe('Passkey Login Flow', () => {
    it('POST /api/v1/auth/passkey/login/options returns 200 with options without authentication', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.startPasskeyLogin.execute).mockResolvedValueOnce({
        options: { challenge: 'auth-opt-ch' }
      });

      const res = await request(app).post('/api/v1/auth/passkey/login/options');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ options: { challenge: 'auth-opt-ch' } });
    });

    it('POST /api/v1/auth/passkey/login/verify returns 200 with user and auth cookies', async () => {
      const { app, mocks } = createTestApp();

      const loggedInUser = {
        id: 'usr-pk-login',
        email: 'pkuser@example.com',
        name: 'PK User',
        emailVerified: true
      };

      vi.mocked(mocks.completePasskeyLogin.execute).mockResolvedValueOnce({
        user: loggedInUser,
        accessToken: 'pk.access.token',
        refreshToken: 'pk.refresh.token'
      });

      const res = await request(app)
          .post('/api/v1/auth/passkey/login/verify')
          .send({
            challenge: 'auth-opt-ch',
            response: { id: 'cred-login-id' }
          });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ user: loggedInUser });

      const cookies = getSetCookies(res);
      expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    });

    it('POST /api/v1/auth/passkey/login/verify returns 401 on unknown passkey or failed authentication', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.completePasskeyLogin.execute).mockRejectedValueOnce(
          new AppError('Invalid Passkey credentials', 401)
      );

      const res = await request(app)
          .post('/api/v1/auth/passkey/login/verify')
          .send({
            challenge: 'auth-opt-ch',
            response: { id: 'unknown-id' }
          });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Invalid Passkey credentials'
      });
    });
  });
});