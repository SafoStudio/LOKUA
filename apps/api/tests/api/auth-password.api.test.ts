import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/test-app.js';
import { AppError } from '../../src/common/index.js';
import { getSetCookies } from '../helpers/get-set-cookies.js';

describe('Auth Password API', () => {
  describe('POST /api/v1/auth/register', () => {
    it('returns 201 with user and sets auth cookies on successful registration', async () => {
      const { app, mocks } = createTestApp();

      const mockUser = {
        id: 'usr-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false
      };

      vi.mocked(mocks.register.execute).mockResolvedValueOnce(mockUser);
      vi.mocked(mocks.issueTokens.execute).mockResolvedValueOnce({
        user: mockUser,
        accessToken: 'access.jwt.token',
        refreshToken: 'refresh.jwt.token'
      });

      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        name: 'Test User',
        password: 'Password123!'
      });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ user: mockUser });

      const cookies = getSetCookies(res);
      expect(cookies.length).toBeGreaterThan(0);

      const accessCookie = cookies.find((c) => c.startsWith('accessToken='));
      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));

      expect(accessCookie).toBeDefined();
      expect(accessCookie).toContain('HttpOnly');
      expect(accessCookie).toContain('Path=/api/v1');
      expect(accessCookie).toContain('SameSite=Lax');

      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/api/v1/auth');
      expect(refreshCookie).toContain('SameSite=Lax');
    });

    it('returns 400 when body fails Zod validation (e.g. invalid email or password < 8)', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'not-an-email',
        name: '',
        password: '123'
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toBe('Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 409 when email already exists', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.register.execute).mockRejectedValueOnce(
          new AppError('Email already registered', 409)
      );

      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'duplicate@example.com',
        name: 'Duplicate',
        password: 'Password123!'
      });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Email already registered'
      });
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 200 with user and sets auth cookies on successful login', async () => {
      const { app, mocks } = createTestApp();

      const mockUser = {
        id: 'usr-456',
        email: 'login@example.com',
        name: 'Login User',
        emailVerified: true
      };

      vi.mocked(mocks.login.execute).mockResolvedValueOnce(mockUser);
      vi.mocked(mocks.issueTokens.execute).mockResolvedValueOnce({
        user: mockUser,
        accessToken: 'login.access.token',
        refreshToken: 'login.refresh.token'
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'login@example.com',
        password: 'CorrectPassword'
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ user: mockUser });

      const cookies = getSetCookies(res);
      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    });

    it('returns 401 on invalid credentials', async () => {
      const { app, mocks } = createTestApp();

      vi.mocked(mocks.login.execute).mockRejectedValueOnce(
          new AppError('Invalid credentials', 401)
      );

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'login@example.com',
        password: 'WrongPassword'
      });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Invalid credentials'
      });
    });

    it('returns 400 when request body is empty or missing fields', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/v1/auth/login').send({});

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toBe('Validation failed');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('returns 200 and clears both auth cookies', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/v1/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Logged out successfully' });

      const cookies = getSetCookies(res);
      expect(cookies.length).toBeGreaterThan(0);

      const clearAccess = cookies.find((c) => c.includes('accessToken=;'));
      const clearRefresh = cookies.find((c) => c.includes('refreshToken=;'));

      expect(clearAccess).toBeDefined();
      expect(clearRefresh).toBeDefined();
    });
  });
});