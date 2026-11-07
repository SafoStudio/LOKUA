import { describe, it, expect, vi } from 'vitest';
import { CompletePasskeyRegistrationUseCase } from '../../../../src/modules/auth/application/index.js';
import type {
  PasskeyChallengeRepository,
  PasskeyCredentialRepository,
  PasskeyVerificationService
} from '../../../../src/modules/auth/application/index.js';


describe('CompletePasskeyRegistrationUseCase', () => {
  const challenges: PasskeyChallengeRepository = {
    create: vi.fn(),
    consume: vi.fn()
  };

  const credentials: PasskeyCredentialRepository = {
    findByCredentialId: vi.fn(),
    findByUserId: vi.fn(),
    create: vi.fn(),
    updateCounter: vi.fn(),
    delete: vi.fn()
  };

  const passkey: PasskeyVerificationService = {
    generateRegistrationOptions: vi.fn(),
    verifyRegistration: vi.fn(),
    generateAuthenticationOptions: vi.fn(),
    verifyAuthentication: vi.fn()
  };

  const useCase = new CompletePasskeyRegistrationUseCase(challenges, credentials, passkey);

  const mockChallenge = {
    id: 'ch-id-1',
    challenge: 'reg-ch-val',
    type: 'REGISTRATION' as const,
    userId: 'user-123',
    email: null,
    name: null,
    expiresAt: new Date(Date.now() + 60000),
    createdAt: new Date()
  };

  const mockCredentialData = {
    credentialId: 'new-cred-123',
    publicKey: Buffer.from('pubkey'),
    counter: '0',
    transports: ['internal'],
    backedUp: false
  };

  it('completes passkey registration for authorized user and saves credential', async () => {
    vi.mocked(challenges.consume).mockResolvedValueOnce(mockChallenge);
    vi.mocked(passkey.verifyRegistration).mockResolvedValueOnce(mockCredentialData);
    vi.mocked(credentials.create).mockResolvedValueOnce(undefined);

    await expect(
      useCase.execute({
        userId: 'user-123',
        challenge: 'reg-ch-val',
        response: { id: 'new-cred-123' }
      })
    ).resolves.toBeUndefined();

    expect(challenges.consume).toHaveBeenCalledWith({
      challenge: 'reg-ch-val',
      type: 'REGISTRATION'
    });

    expect(credentials.create).toHaveBeenCalledWith({
      userId: 'user-123',
      ...mockCredentialData
    });
  });

  it('throws AppError 400 when challenge is invalid or expired', async () => {
    vi.mocked(challenges.consume).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        userId: 'user-123',
        challenge: 'expired-ch',
        response: { id: 'cred' }
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid or expired Passkey challenge'
    });
  });

  it('throws AppError 403 when challenge userId does not match current user', async () => {
    vi.mocked(challenges.consume).mockResolvedValueOnce(mockChallenge);

    await expect(
      useCase.execute({
        userId: 'different-user-456',
        challenge: 'reg-ch-val',
        response: { id: 'cred' }
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Invalid Passkey challenge owner'
    });

    expect(passkey.verifyRegistration).not.toHaveBeenCalled();
  });

  it('throws AppError 400 when verification returns null', async () => {
    vi.mocked(challenges.consume).mockResolvedValueOnce(mockChallenge);
    vi.mocked(passkey.verifyRegistration).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        userId: 'user-123',
        challenge: 'reg-ch-val',
        response: { id: 'bad-cred' }
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Passkey verification failed'
    });

    expect(credentials.create).not.toHaveBeenCalled();
  });

  it('throws AppError 409 when passkey is already registered (unique constraint code 23505)', async () => {
    vi.mocked(challenges.consume).mockResolvedValueOnce(mockChallenge);
    vi.mocked(passkey.verifyRegistration).mockResolvedValueOnce(mockCredentialData);

    const uniqueError = {
      driverError: {
        code: '23505'
      }
    };
    vi.mocked(credentials.create).mockRejectedValueOnce(uniqueError);

    await expect(
      useCase.execute({
        userId: 'user-123',
        challenge: 'reg-ch-val',
        response: { id: 'new-cred-123' }
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Passkey already registered'
    });
  });
});
