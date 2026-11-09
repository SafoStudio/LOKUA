import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/test-app.js';
import { AppError } from '../../src/common/index.js';

describe('Auth Email Verification API', () => {
    describe('GET /api/v1/auth/verify-email', () => {
        it('returns 200 when token is valid', async () => {
            const { app, mocks } = createTestApp();

            vi.mocked(mocks.verifyEmail.execute).mockResolvedValueOnce();

            const res = await request(app)
                .get('/api/v1/auth/verify-email')
                .query({ token: 'valid-token' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: 'Email verified successfully' });
            expect(mocks.verifyEmail.execute).toHaveBeenCalledWith(
                'valid-token',
                expect.objectContaining({ ip: expect.any(String) })
            );
        });

        it('returns 400 when token is missing', async () => {
            const { app } = createTestApp();

            const res = await request(app).get('/api/v1/auth/verify-email');

            expect(res.status).toBe(400);
            expect(res.body.status).toBe('error');
            expect(res.body.message).toBe('Validation failed');
        });

        it('returns 400 when token is invalid or expired', async () => {
            const { app, mocks } = createTestApp();

            vi.mocked(mocks.verifyEmail.execute).mockRejectedValueOnce(
                new AppError('Invalid or expired verification token', 400)
            );

            const res = await request(app)
                .get('/api/v1/auth/verify-email')
                .query({ token: 'bad-token' });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({
                status: 'error',
                message: 'Invalid or expired verification token'
            });
        });
    });

    describe('POST /api/v1/auth/verify-email/resend', () => {
        it('returns 200 when authenticated', async () => {
            const { app, mocks } = createTestApp();

            const mockUser = {
                id: 'user-1',
                email: 'user@example.com',
                name: 'User',
                emailVerified: false
            };

            vi.mocked(mocks.tokenService.verifyAccessToken).mockResolvedValueOnce({
                userId: 'user-1'
            });
            vi.mocked(mocks.users.findById).mockResolvedValueOnce(mockUser);
            vi.mocked(mocks.sendVerificationEmail.execute).mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/v1/auth/verify-email/resend')
                .set('Cookie', ['accessToken=valid-token']);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: 'Verification email sent' });
            expect(mocks.sendVerificationEmail.execute).toHaveBeenCalledWith('user-1');
        });

        it('returns 401 when not authenticated', async () => {
            const { app } = createTestApp();

            const res = await request(app).post('/api/v1/auth/verify-email/resend');

            expect(res.status).toBe(401);
            expect(res.body).toEqual({
                status: 'error',
                message: 'Authentication required'
            });
        });
    });
});