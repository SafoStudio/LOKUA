import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { ResetPasswordUseCase } from '../../../../src/modules/auth/application/index.js';
import type {
    PasswordCredentialRepository,
    PasswordResetTokenRepository,
    PasswordHasher,
    RefreshSessionRepository,
    SecurityEventRepository
} from '../../../../src/modules/auth/application/index.js';

describe('ResetPasswordUseCase', () => {
    const tokens: PasswordResetTokenRepository = {
        create: vi.fn(),
        consumeByHash: vi.fn()
    };

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

    const useCase = new ResetPasswordUseCase(
        tokens,
        passwordCredentials,
        passwordHasher,
        refreshSessions,
        securityEvents
    );

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('consumes token, updates password, revokes sessions and records event', async () => {
        const rawToken = 'a'.repeat(64);
        const expectedHash = createHash('sha256').update(rawToken).digest('hex');

        vi.mocked(tokens.consumeByHash).mockResolvedValueOnce({
            id: 'tok-1',
            userId: 'user-1',
            tokenHash: expectedHash,
            expiresAt: new Date(Date.now() + 60_000),
            createdAt: new Date()
        });
        vi.mocked(passwordHasher.hash).mockResolvedValueOnce('new-hash');

        await useCase.execute({ token: rawToken, password: 'NewPassword123' }, context);

        expect(tokens.consumeByHash).toHaveBeenCalledWith(expectedHash);
        expect(passwordHasher.hash).toHaveBeenCalledWith('NewPassword123');
        expect(passwordCredentials.updatePasswordHash).toHaveBeenCalledWith('user-1', 'new-hash');
        expect(refreshSessions.revokeAllByUserId).toHaveBeenCalledWith('user-1');
        expect(securityEvents.record).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                eventType: 'PASSWORD_RESET_COMPLETED'
            })
        );
    });

    it('throws AppError 400 when token is empty', async () => {
        await expect(
            useCase.execute({ token: '', password: 'NewPassword123' }, context)
        ).rejects.toMatchObject({
            statusCode: 400,
            message: 'Reset token is required'
        });

        expect(tokens.consumeByHash).not.toHaveBeenCalled();
    });

    it('throws AppError 400 when token is invalid or expired', async () => {
        vi.mocked(tokens.consumeByHash).mockResolvedValueOnce(null);

        await expect(
            useCase.execute({ token: 'unknown-token', password: 'NewPassword123' }, context)
        ).rejects.toMatchObject({
            statusCode: 400,
            message: 'Invalid or expired reset token'
        });

        expect(passwordCredentials.updatePasswordHash).not.toHaveBeenCalled();
        expect(refreshSessions.revokeAllByUserId).not.toHaveBeenCalled();
    });

    it('throws AppError 400 when new password exceeds 72 bytes', async () => {
        const rawToken = 'a'.repeat(64);
        const expectedHash = createHash('sha256').update(rawToken).digest('hex');

        vi.mocked(tokens.consumeByHash).mockResolvedValueOnce({
            id: 'tok-1',
            userId: 'user-1',
            tokenHash: expectedHash,
            expiresAt: new Date(Date.now() + 60_000),
            createdAt: new Date()
        });

        await expect(
            useCase.execute({ token: rawToken, password: 'a'.repeat(73) }, context)
        ).rejects.toMatchObject({
            statusCode: 400,
            message: 'Password must not exceed 72 bytes'
        });

        expect(passwordCredentials.updatePasswordHash).not.toHaveBeenCalled();
        expect(refreshSessions.revokeAllByUserId).not.toHaveBeenCalled();
    });
});