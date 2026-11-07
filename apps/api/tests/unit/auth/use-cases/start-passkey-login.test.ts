import { describe, it, expect, vi } from 'vitest';
import { StartPasskeyLoginUseCase } from '../../../../src/modules/auth/application/index.js';
import type {
  PasskeyChallengeRepository,
  PasskeyVerificationService
} from '../../../../src/modules/auth/application/index.js';

describe('StartPasskeyLoginUseCase', () => {
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

  const useCase = new StartPasskeyLoginUseCase(challenges, passkey);

  it('generates authentication options and saves AUTHENTICATION challenge', async () => {
    vi.mocked(passkey.generateAuthenticationOptions).mockResolvedValueOnce({
      challenge: 'login-ch-xyz',
      options: { challenge: 'login-ch-xyz' }
    });

    const result = await useCase.execute();

    expect(result).toEqual({ options: { challenge: 'login-ch-xyz' } });

    expect(challenges.create).toHaveBeenCalledWith(
      expect.objectContaining({
        challenge: 'login-ch-xyz',
        type: 'AUTHENTICATION'
      })
    );
  });
});
