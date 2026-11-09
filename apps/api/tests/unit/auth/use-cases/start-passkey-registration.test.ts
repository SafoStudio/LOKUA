import { describe, it, expect, vi } from 'vitest';
import { StartPasskeyRegistrationUseCase } from '../../../../src/modules/auth/application/index.js';
import type { UserProvider } from '../../../../src/modules/auth/index.js';
import type {
  PasskeyChallengeRepository,
  PasskeyVerificationService,
  PasskeyCredentialRepository
} from '../../../../src/modules/auth/application/index.js';


describe('StartPasskeyRegistrationUseCase', () => {
  const users: UserProvider = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    markEmailVerified: vi.fn()
  };

  const credentials: PasskeyCredentialRepository = {
    findByCredentialId: vi.fn(),
    findByUserId: vi.fn(),
    create: vi.fn(),
    updateCounter: vi.fn(),
    delete: vi.fn()
  };

  const challenges: PasskeyChallengeRepository = {
    create: vi.fn(),
    consume: vi.fn()
  };

  const passkey: PasskeyVerificationService = {
    generateRegistrationOptions: vi.fn(),
    verifyRegistration: vi.fn(),
    generateAuthenticationOptions: vi.fn(),
    verifyAuthentication: vi.fn()
  };

  const useCase = new StartPasskeyRegistrationUseCase(users, credentials, challenges, passkey);

  it('generates options and populates existing credentials in exclude list', async () => {
    const user = {
      id: 'existing-user-1',
      email: 'user@example.com',
      name: 'User',
      emailVerified: true
    };

    vi.mocked(users.findById).mockResolvedValueOnce(user);
    vi.mocked(credentials.findByUserId).mockResolvedValueOnce([
      {
        id: 'cred-db-1',
        userId: 'existing-user-1',
        credentialId: 'existing-cred-id',
        publicKey: Buffer.from('key'),
        counter: '5',
        transports: ['usb'],
        backedUp: true
      }
    ]);

    vi.mocked(passkey.generateRegistrationOptions).mockResolvedValueOnce({
      challenge: 'reg-ch-123',
      options: { challenge: 'reg-ch-123' }
    });

    const result = await useCase.execute({ userId: 'existing-user-1' });

    expect(result).toEqual({ options: { challenge: 'reg-ch-123' } });

    expect(passkey.generateRegistrationOptions).toHaveBeenCalledWith({
      userId: 'existing-user-1',
      email: 'user@example.com',
      name: 'User',
      existingCredentials: [
        {
          credentialId: 'existing-cred-id',
          transports: ['usb']
        }
      ]
    });

    expect(challenges.create).toHaveBeenCalledWith(
      expect.objectContaining({
        challenge: 'reg-ch-123',
        type: 'REGISTRATION',
        userId: 'existing-user-1'
      })
    );
  });

  it('throws AppError 404 when user is not found', async () => {
    vi.mocked(users.findById).mockResolvedValueOnce(null);

    await expect(useCase.execute({ userId: 'unknown' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found'
    });
  });
});
