import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangePasswordUseCase } from '../../../../src/modules/auth/application/index.js';
import type {
    PasswordCredentialRepository,
    PasswordHasher,
    RefreshSessionRepository,
    SecurityEventRepository
} from '../../../../src/modules/auth/application/index.js';

describe('ChangePasswordUseCase', () => {
    const passwordCredentials: PasswordCredentialRepository = {
        findByUserId: vi.fn(),
        create: vi.fn(),
        updatePasswordHash: vi.fn()
    };

    const passwordHasher: PasswordHasher = {
        hash: vi.fn(),
        compare: vi.fn()
    };

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

    const useCase = new ChangePasswordUseCase(
        passwordCredentials,
        passwordHasher,
        refreshSessions,
        securityEvents
    );

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('updates password, revokes sessions and records event', async () => {
        vi.mocked(passwordCredentials.findByUserId).mockResolvedValueOnce({
            userId: 'user-1',
            passwordHash: 'old-hash'
        });
        vi.mocked(passwordHasher.compare).mockResolvedValueOnce(true);
        vi.mocked(passwordHasher.compare).mockResolvedValueOnce(false);
        vi.mocked(passwordHasher.hash).mockResolvedValueOnce('new-hash');

        await useCase.execute(
            {
                userId: 'user-1',
                currentPassword: 'OldPassword123',
                newPassword: 'NewPassword123'
            },
            context
        );

        expect(passwordHasher.compare).toHaveBeenNthCalledWith(1, 'OldPassword123', 'old-hash');
        expect(passwordHasher.compare).toHaveBeenNthCalledWith(2, 'NewPassword123', 'old-hash');
        expect(passwordCredentials.updatePasswordHash).toHaveBeenCalledWith('user-1', 'new-hash');
        expect(refreshSessions.revokeAllByUserId).toHaveBeenCalledWith('user-1');
        expect(securityEvents.record).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                eventType: 'PASSWORD_CHANGED'
            })
        );
    });

    it('throws AppError 400 when account has no password credential', async () => {
        vi.mocked(passwordCredentials.findByUserId).mockResolvedValueOnce(null);

        await expect(
            useCase.execute(
                {
                    userId: 'google-user',
                    currentPassword: 'OldPassword123',
                    newPassword: 'NewPassword123'
                },
                context
            )
        ).rejects.toMatchObject({
            statusCode: 400,
            message: 'Password is not set for this account'
        });

        expect(passwordCredentials.updatePasswordHash).not.toHaveBeenCalled();
        expect(refreshSessions.revokeAllByUserId).not.toHaveBeenCalled();
    });

    it('throws AppError 401 when current password is incorrect', async () => {
        vi.mocked(passwordCredentials.findByUserId).mockResolvedValueOnce({
            userId: 'user-1',
            passwordHash: 'old-hash'
        });
        vi.mocked(passwordHasher.compare).mockResolvedValueOnce(false);

        await expect(
            useCase.execute(
                {
                    userId: 'user-1',
                    currentPassword: 'WrongPassword',
                    newPassword: 'NewPassword123'
                },
                context
            )
        ).rejects.toMatchObject({
            statusCode: 401,
            message: 'Current password is incorrect'
        });

        expect(passwordCredentials.updatePasswordHash).not.toHaveBeenCalled();
        expect(refreshSessions.revokeAllByUserId).not.toHaveBeenCalled();
    });

    it('throws AppError 400 when new password equals current', async () => {
        vi.mocked(passwordCredentials.findByUserId).mockResolvedValueOnce({
            userId: 'user-1',
            passwordHash: 'old-hash'
        });
        vi.mocked(passwordHasher.compare).mockResolvedValueOnce(true);
        vi.mocked(passwordHasher.compare).mockResolvedValueOnce(true);

        await expect(
            useCase.execute(
                {
                    userId: 'user-1',
                    currentPassword: 'SamePassword123',
                    newPassword: 'SamePassword123'
                },
                context
            )
        ).rejects.toMatchObject({
            statusCode: 400,
            message: 'New password must differ from current'
        });

        expect(passwordCredentials.updatePasswordHash).not.toHaveBeenCalled();
        expect(refreshSessions.revokeAllByUserId).not.toHaveBeenCalled();
    });

    it('throws AppError 400 when new password exceeds 72 bytes', async () => {
        vi.mocked(passwordCredentials.findByUserId).mockResolvedValueOnce({
            userId: 'user-1',
            passwordHash: 'old-hash'
        });
        vi.mocked(passwordHasher.compare).mockResolvedValueOnce(true);
        vi.mocked(passwordHasher.compare).mockResolvedValueOnce(false);

        await expect(
            useCase.execute(
                {
                    userId: 'user-1',
                    currentPassword: 'OldPassword123',
                    newPassword: 'a'.repeat(73)
                },
                context
            )
        ).rejects.toMatchObject({
            statusCode: 400,
            message: 'Password must not exceed 72 bytes'
        });

        expect(passwordCredentials.updatePasswordHash).not.toHaveBeenCalled();
    });
});