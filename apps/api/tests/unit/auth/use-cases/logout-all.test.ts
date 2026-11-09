import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogoutAllUseCase } from '../../../../src/modules/auth/application/index.js';
import type {
    RefreshSessionRepository,
    SecurityEventRepository
} from '../../../../src/modules/auth/application/index.js';

describe('LogoutAllUseCase', () => {
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

    const useCase = new LogoutAllUseCase(refreshSessions, securityEvents);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('revokes all sessions for user and records event', async () => {
        await useCase.execute('user-1', context);

        expect(refreshSessions.revokeAllByUserId).toHaveBeenCalledWith('user-1');
        expect(securityEvents.record).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                eventType: 'LOGOUT_ALL',
                ip: '127.0.0.1',
                userAgent: 'vitest'
            })
        );
    });
});