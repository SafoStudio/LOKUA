import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/test-app.js';
import { AppError } from '../../src/common/index.js';

describe('Auth Change Password API', () => {
    const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        emailVerified: true
    };

    function authenticatedApp() {
        const { app, mocks } = createTestApp();
        vi.mocked(mocks.tokenService.verifyAccessToken).mockResolvedValue({
            userId: 'user-1'
        });
        vi.mocked(mocks.users.findById).mockResolvedValue(mockUser);
        return { app, mocks };
    }

    describe('POST /api/v1/auth/change-password', () => {
        it('returns 200 when current password is correct', async () => {
            const { app, mocks } = authenticatedApp();

            vi.mocked(mocks.changePassword.execute).mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Cookie', ['accessToken=valid-token'])
                .send({ currentPassword: 'OldPassword123', newPassword: 'NewPassword123' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: 'Password changed successfully' });
            expect(mocks.changePassword.execute).toHaveBeenCalledWith(
                {
                    userId: 'user-1',
                    currentPassword: 'OldPassword123',
                    newPassword: 'NewPassword123'
                },
                expect.objectContaining({ ip: expect.any(String) })
            );
        });

        it('returns 401 when not authenticated', async () => {
            const { app } = createTestApp();

            const res = await request(app)
                .post('/api/v1/auth/change-password')
                .send({ currentPassword: 'OldPassword123', newPassword: 'NewPassword123' });

            expect(res.status).toBe(401);
            expect(res.body).toEqual({
                status: 'error',
                message: 'Authentication required'
            });
        });

        it('returns 401 when current password is incorrect', async () => {
            const { app, mocks } = authenticatedApp();

            vi.mocked(mocks.changePassword.execute).mockRejectedValueOnce(
                new AppError('Current password is incorrect', 401)
            );

            const res = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Cookie', ['accessToken=valid-token'])
                .send({ currentPassword: 'WrongPassword', newPassword: 'NewPassword123' });

            expect(res.status).toBe(401);
            expect(res.body).toEqual({
                status: 'error',
                message: 'Current password is incorrect'
            });
        });

        it('returns 400 when new password equals current', async () => {
            const { app, mocks } = authenticatedApp();

            vi.mocked(mocks.changePassword.execute).mockRejectedValueOnce(
                new AppError('New password must differ from current', 400)
            );

            const res = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Cookie', ['accessToken=valid-token'])
                .send({ currentPassword: 'Same123456', newPassword: 'Same123456' });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({
                status: 'error',
                message: 'New password must differ from current'
            });
        });

        it('returns 400 when body fails validation', async () => {
            const { app } = authenticatedApp();

            const res = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Cookie', ['accessToken=valid-token'])
                .send({ currentPassword: '', newPassword: '123' });

            expect(res.status).toBe(400);
            expect(res.body.status).toBe('error');
            expect(res.body.message).toBe('Validation failed');
        });
    });
});