import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/test-app.js';
import { getSetCookies } from '../helpers/get-set-cookies.js';

describe('Auth Logout All API', () => {
    const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        emailVerified: true
    };

    it('returns 200, revokes all sessions and clears cookies', async () => {
        const { app, mocks } = createTestApp();

        vi.mocked(mocks.tokenService.verifyAccessToken).mockResolvedValueOnce({
            userId: 'user-1'
        });
        vi.mocked(mocks.users.findById).mockResolvedValueOnce(mockUser);
        vi.mocked(mocks.logoutAll.execute).mockResolvedValueOnce();

        const res = await request(app)
            .post('/api/v1/auth/logout-all')
            .set('Cookie', ['accessToken=valid-token']);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: 'Logged out from all devices' });
        expect(mocks.logoutAll.execute).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({ ip: expect.any(String) })
        );

        const cookies = getSetCookies(res);
        expect(cookies.some((c) => c.includes('accessToken=;'))).toBe(true);
        expect(cookies.some((c) => c.includes('refreshToken=;'))).toBe(true);
    });

    it('returns 401 when not authenticated', async () => {
        const { app } = createTestApp();

        const res = await request(app).post('/api/v1/auth/logout-all');

        expect(res.status).toBe(401);
        expect(res.body).toEqual({
            status: 'error',
            message: 'Authentication required'
        });
    });
});