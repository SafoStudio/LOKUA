import { describe, it, expect, vi } from 'vitest';
import type { UserProvider } from '../../../../src/modules/auth/index.js';
import type {
  PasskeyChallengeRepository,
  PasskeyCredentialRepository,
  PasskeyVerificationService,
  TokenService
} from '../../../../src/modules/auth/application/index.js';
import {
  IssueAuthTokensUseCase,
  CompletePasskeyLoginUseCase
} from '../../../../src/modules/auth/application/index.js';

describe('CompletePasskeyLoginUseCase', () => {
  const users: UserProvider = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn()
  };

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

  const tokenService: TokenService = {
    signAccessToken: vi.fn().mockResolvedValue('access-token'),
    signRefreshToken: vi.fn().mockResolvedValue('refresh-token'),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn()
  };

  const issueTokens = new IssueAuthTokensUseCase(tokenService);

  const useCase = new CompletePasskeyLoginUseCase(
    users,
    challenges,
    credentials,
    passkey,
    issueTokens
  );

  const mockUser = {
    id: 'user-passkey-1',
    email: 'charlie@example.com',
    name: 'Charlie',
    emailVerified: true
  };

  const mockChallenge = {
    id: 'ch-id-1',
    challenge: 'auth-ch-val',
    type: 'AUTHENTICATION' as const,
    userId: null,
    email: null,
    name: null,
    expiresAt: new Date(Date.now() + 60000),
    createdAt: new Date()
  };

  const mockStoredCredential = {
    id: 'db-id-1',
    userId: 'user-passkey-1',
    credentialId: 'cred-charlie-id',
    publicKey: Buffer.from('public-key'),
    counter: '10',
    transports: ['internal'],
    backedUp: true
  };

  it('completes passkey login, updates counter and returns auth tokens', async () => {
    vi.mocked(challenges.consume).mockResolvedValueOnce(mockChallenge);
    vi.mocked(credentials.findByCredentialId).mockResolvedValueOnce(mockStoredCredential);
    vi.mocked(passkey.verifyAuthentication).mockResolvedValueOnce({ newCounter: '11' });
    vi.mocked(users.findById).mockResolvedValueOnce(mockUser);
    vi.mocked(credentials.updateCounter).mockResolvedValueOnce();

    const result = await useCase.execute({
      challenge: 'auth-ch-val',
      response: { id: 'cred-charlie-id' }
    });

    expect(result.user).toEqual(mockUser);
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');

    expect(challenges.consume).toHaveBeenCalledWith({
      challenge: 'auth-ch-val',
      type: 'AUTHENTICATION'
    });

    expect(credentials.updateCounter).toHaveBeenCalledWith('cred-charlie-id', '11');
  });

  it('throws AppError 400 when response is missing id', async () => {
    await expect(
      useCase.execute({
        challenge: 'auth-ch-val',
        response: {}
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid Passkey response'
    });

    expect(challenges.consume).not.toHaveBeenCalled();
  });

  it('throws AppError 400 when challenge is invalid or expired', async () => {
    vi.mocked(challenges.consume).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        challenge: 'expired-ch',
        response: { id: 'cred-charlie-id' }
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid or expired Passkey challenge'
    });

    expect(credentials.findByCredentialId).not.toHaveBeenCalled();
  });

  it('throws AppError 401 when credential is not found in database', async () => {
    vi.mocked(challenges.consume).mockResolvedValueOnce(mockChallenge);
    vi.mocked(credentials.findByCredentialId).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        challenge: 'auth-ch-val',
        response: { id: 'unknown-cred' }
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid Passkey credentials'
    });

    expect(passkey.verifyAuthentication).not.toHaveBeenCalled();
  });

  it('throws AppError 401 when passkey signature verification fails', async () => {
    vi.mocked(challenges.consume).mockResolvedValueOnce(mockChallenge);
    vi.mocked(credentials.findByCredentialId).mockResolvedValueOnce(mockStoredCredential);
    vi.mocked(passkey.verifyAuthentication).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        challenge: 'auth-ch-val',
        response: { id: 'cred-charlie-id' }
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Passkey authentication failed'
    });

    expect(credentials.updateCounter).not.toHaveBeenCalled();
  });
});
