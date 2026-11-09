import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/test-app.js';
import { AppError } from '../../src/common/index.js';

describe('Auth Password Reset API', () => {
    describe('POST /api/v1/auth/password-reset/request', () => {
        it('returns 200 with generic message when email exists', async () => {
            const { app, mocks } = createTestApp();

            vi.mocked(mocks.requestPasswordReset.execute).mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/v1/auth/password-reset/request')
                .send({ email: 'user@example.com' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                message: 'If the email exists, a password reset link has been sent'
            });
            expect(mocks.requestPasswordReset.execute).toHaveBeenCalledWith(
                'user@example.com',
                expect.objectContaining({ ip: expect.any(String) })
            );
        });

        it('returns 200 with the same message when email does not exist (enumeration protection)', async () => {
            const { app, mocks } = createTestApp();

            vi.mocked(mocks.requestPasswordReset.execute).mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/v1/auth/password-reset/request')
                .send({ email: 'unknown@example.com' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                message: 'If the email exists, a password reset link has been sent'
            });
        });

        it('returns 400 when email is invalid', async () => {
            const { app } = createTestApp();

            const res = await request(app)
                .post('/api/v1/auth/password-reset/request')
                .send({ email: 'not-an-email' });

            expect(res.status).toBe(400);
            expect(res.body.status).toBe('error');
            expect(res.body.message).toBe('Validation failed');
        });
    });

    describe('POST /api/v1/auth/password-reset', () => {
        it('returns 200 when token is valid', async () => {
            const { app, mocks } = createTestApp();

            vi.mocked(mocks.resetPassword.execute).mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/v1/auth/password-reset')
                .send({ token: 'valid-reset-token', password: 'NewPassword123' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: 'Password reset successfully' });
            expect(mocks.resetPassword.execute).toHaveBeenCalledWith(
                { token: 'valid-reset-token', password: 'NewPassword123' },
                expect.objectContaining({ ip: expect.any(String) })
            );
        });

        it('returns 400 when token is invalid or expired', async () => {
            const { app, mocks } = createTestApp();

            vi.mocked(mocks.resetPassword.execute).mockRejectedValueOnce(
                new AppError('Invalid or expired reset token', 400)
            );

            const res = await request(app)
                .post('/api/v1/auth/password-reset')
                .send({ token: 'bad-token', password: 'NewPassword123' });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({
                status: 'error',
                message: 'Invalid or expired reset token'
            });
        });

        it('returns 400 when password is too short', async () => {
            const { app } = createTestApp();

            const res = await request(app)
                .post('/api/v1/auth/password-reset')
                .send({ token: 'valid-token', password: '123' });

            expect(res.status).toBe(400);
            expect(res.body.status).toBe('error');
            expect(res.body.message).toBe('Validation failed');
        });
    });
});