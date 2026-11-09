import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { LogoutUseCase } from '../../../../src/modules/auth/application/index.js';
import type {
    RefreshSessionRepository,
    SecurityEventRepository
} from '../../../../src/modules/auth/application/index.js';

describe('LogoutUseCase', () => {
    const refreshSessions: RefreshSessionRepository = {
        create: vi.fn(),
        findById: vi.fn(),
        revokeById: vi.fn(),
        revokeByTokenHash: vi.fn(),
        revokeAllByUserId: vi.fn()
    };

    const securityEvents: SecurityEventRepository = {
        record: vi.fn()
    };

    const context = { ip: '127.0.0.1', userAgent: 'vitest' };

    const useCase = new LogoutUseCase(refreshSessions, securityEvents);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('revokes session by token hash and records event', async () => {
        const rawToken = 'refresh-token-value';
        const expectedHash = createHash('sha256').update(rawToken).digest('hex');

        await useCase.execute(rawToken, context);

        expect(refreshSessions.revokeByTokenHash).toHaveBeenCalledWith(expectedHash);
        expect(securityEvents.record).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: null,
                eventType: 'LOGOUT',
                ip: '127.0.0.1',
                userAgent: 'vitest'
            })
        );
    });

    it('returns silently when refresh token is undefined', async () => {
        await useCase.execute(undefined, context);

        expect(refreshSessions.revokeByTokenHash).not.toHaveBeenCalled();
        expect(securityEvents.record).not.toHaveBeenCalled();
    });
});