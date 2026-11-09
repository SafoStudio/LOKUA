import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { RequestPasswordResetUseCase } from '../../../../src/modules/auth/application/index.js';
import type {
    UserProvider,
    PasswordCredentialRepository,
    PasswordResetTokenRepository,
    EmailService,
    SecurityEventRepository
} from '../../../../src/modules/auth/application/index.js';

describe('RequestPasswordResetUseCase', () => {
    const users: UserProvider = {
        findById: vi.fn(),
        findByEmail: vi.fn(),
        create: vi.fn(),
        markEmailVerified: vi.fn()
    };

    const passwordCredentials: PasswordCredentialRepository = {
        findByUserId: vi.fn(),
        create: vi.fn(),
        updatePasswordHash: vi.fn()
    };

    const tokens: PasswordResetTokenRepository = {
        create: vi.fn(),
        consumeByHash: vi.fn()
    };

    const emailService: EmailService = {
        sendVerificationEmail: vi.fn(),
        sendPasswordResetEmail: vi.fn()
    };

    const securityEvents: SecurityEventRepository = {
        record: vi.fn()
    };

    const context = { ip: '127.0.0.1', userAgent: 'vitest' };

    const useCase = new RequestPasswordResetUseCase(
        users,
        passwordCredentials,
        tokens,
        emailService,
        securityEvents
    );

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates token, sends email and records event when user with password exists', async () => {
        vi.mocked(users.findByEmail).mockResolvedValueOnce({
            id: 'user-1',
            email: 'user@example.com',
            name: 'User',
            emailVerified: true
        });
        vi.mocked(passwordCredentials.findByUserId).mockResolvedValueOnce({
            userId: 'user-1',
            passwordHash: 'stored-hash'
        });

        await useCase.execute('  USER@example.COM  ', context);

        expect(users.findByEmail).toHaveBeenCalledWith('user@example.com');
        expect(passwordCredentials.findByUserId).toHaveBeenCalledWith('user-1');
        expect(tokens.create).toHaveBeenCalledTimes(1);

        const createArg = vi.mocked(tokens.create).mock.calls[0][0];
        expect(createArg.userId).toBe('user-1');
        expect(createArg.tokenHash).toMatch(/^[a-f0-9]{64}$/);
        expect(createArg.expiresAt.getTime()).toBeGreaterThan(Date.now());

        expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
        const emailArg = vi.mocked(emailService.sendPasswordResetEmail).mock.calls[0][0];
        expect(emailArg.to).toBe('user@example.com');
        expect(emailArg.name).toBe('User');
        expect(emailArg.token).toMatch(/^[a-f0-9]{64}$/);

        const expectedHash = createHash('sha256').update(emailArg.token).digest('hex');
        expect(createArg.tokenHash).toBe(expectedHash);

        expect(securityEvents.record).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                eventType: 'PASSWORD_RESET_REQUESTED'
            })
        );
    });

    it('silently returns when user does not exist', async () => {
        vi.mocked(users.findByEmail).mockResolvedValueOnce(null);

        await expect(useCase.execute('unknown@example.com', context)).resolves.toBeUndefined();

        expect(tokens.create).not.toHaveBeenCalled();
        expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
        expect(securityEvents.record).not.toHaveBeenCalled();
    });

    it('silently returns when user has no password credential', async () => {
        vi.mocked(users.findByEmail).mockResolvedValueOnce({
            id: 'google-user',
            email: 'google@example.com',
            name: 'Google User',
            emailVerified: true
        });
        vi.mocked(passwordCredentials.findByUserId).mockResolvedValueOnce(null);

        await expect(useCase.execute('google@example.com', context)).resolves.toBeUndefined();

        expect(tokens.create).not.toHaveBeenCalled();
        expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
        expect(securityEvents.record).not.toHaveBeenCalled();
    });

    it('records event even when SMTP delivery fails', async () => {
        vi.mocked(users.findByEmail).mockResolvedValueOnce({
            id: 'user-1',
            email: 'user@example.com',
            name: 'User',
            emailVerified: true
        });
        vi.mocked(passwordCredentials.findByUserId).mockResolvedValueOnce({
            userId: 'user-1',
            passwordHash: 'stored-hash'
        });
        vi.mocked(emailService.sendPasswordResetEmail).mockRejectedValueOnce(
            new Error('SMTP down')
        );

        await expect(useCase.execute('user@example.com', context)).resolves.toBeUndefined();

        expect(tokens.create).toHaveBeenCalledTimes(1);
        expect(securityEvents.record).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                eventType: 'PASSWORD_RESET_REQUESTED'
            })
        );
    });
});