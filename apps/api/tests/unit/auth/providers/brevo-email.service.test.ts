import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMailMock = vi.fn();

vi.mock('nodemailer', () => ({
    default: {
        createTransport: vi.fn(() => ({ sendMail: sendMailMock }))
    }
}));

describe('BrevoEmailService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sendMailMock.mockResolvedValue(undefined);
    });

    it('sends verification email with expected fields', async () => {
        const { BrevoEmailService } = await import(
            '../../../../src/modules/auth/infrastructure/index.js'
            );
        const service = new BrevoEmailService();

        await service.sendVerificationEmail({
            to: 'user@example.com',
            name: 'User',
            token: 'abc123'
        });

        expect(sendMailMock).toHaveBeenCalledTimes(1);
        const mail = sendMailMock.mock.calls[0][0];
        expect(mail.to).toBe('user@example.com');
        expect(mail.subject).toBe('Confirm your email');
        expect(mail.html).toContain('abc123');
        expect(mail.html).toContain('User');
        expect(mail.html).toContain('/api/v1/auth/verify-email?token=');
    });

    it('escapes HTML in user name for verification email', async () => {
        const { BrevoEmailService } = await import(
            '../../../../src/modules/auth/infrastructure/index.js'
            );
        const service = new BrevoEmailService();

        await service.sendVerificationEmail({
            to: 'user@example.com',
            name: '<script>alert(1)</script>',
            token: 'abc123'
        });

        const mail = sendMailMock.mock.calls[0][0];
        expect(mail.html).not.toContain('<script>');
        expect(mail.html).toContain('&lt;script&gt;');
    });

    it('sends password reset email with CLIENT_URL link', async () => {
        const { BrevoEmailService } = await import(
            '../../../../src/modules/auth/infrastructure/index.js'
            );
        const service = new BrevoEmailService();

        await service.sendPasswordResetEmail({
            to: 'user@example.com',
            name: 'User',
            token: 'reset-token-abc'
        });

        const mail = sendMailMock.mock.calls[0][0];
        expect(mail.to).toBe('user@example.com');
        expect(mail.subject).toBe('Reset your password');
        expect(mail.html).toContain('reset-token-abc');
        expect(mail.html).toContain('/reset-password?token=');
        expect(mail.html).toContain('1 hour');
    });
});