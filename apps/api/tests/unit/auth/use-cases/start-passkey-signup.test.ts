import { describe, it, expect, vi } from 'vitest';
import { StartPasskeySignupUseCase } from '../../../../src/modules/auth/application/index.js';
import type { UserProvider } from '../../../../src/modules/auth/index.js';
import type {
  PasskeyChallengeRepository,
  PasskeyVerificationService
} from '../../../../src/modules/auth/application/index.js';

describe('StartPasskeySignupUseCase', () => {
  const users: UserProvider = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn()
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

  const useCase = new StartPasskeySignupUseCase(users, challenges, passkey);

  it('generates options and saves SIGNUP challenge when email is available', async () => {
    vi.mocked(users.findByEmail).mockResolvedValueOnce(null);
    vi.mocked(passkey.generateRegistrationOptions).mockResolvedValueOnce({
      challenge: 'random-challenge-xyz',
      options: { rp: { id: 'localhost' } }
    });

    const result = await useCase.execute({
      email: '  Alice@example.com  ',
      name: '  Alice  '
    });

    expect(result).toEqual({ options: { rp: { id: 'localhost' } } });

    expect(users.findByEmail).toHaveBeenCalledWith('alice@example.com');
    expect(passkey.generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'alice@example.com',
        name: 'Alice',
        existingCredentials: []
      })
    );

    expect(challenges.create).toHaveBeenCalledWith(
      expect.objectContaining({
        challenge: 'random-challenge-xyz',
        type: 'SIGNUP',
        email: 'alice@example.com',
        name: 'Alice'
      })
    );
  });

  it('throws AppError 409 if email is already registered', async () => {
    vi.mocked(users.findByEmail).mockResolvedValueOnce({
      id: 'existing-id',
      email: 'alice@example.com',
      name: 'Alice',
      emailVerified: true
    });

    await expect(
      useCase.execute({
        email: 'alice@example.com',
        name: 'Alice'
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Email already registered'
    });

    expect(challenges.create).not.toHaveBeenCalled();
  });
});
