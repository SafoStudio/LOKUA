import { describe, it, expect, vi } from 'vitest';
import { CompletePasskeySignupUseCase } from '../../../../src/modules/auth/application/index.js';
import type {
  PasskeyVerificationService,
  PasskeySignupTransaction,
  PasskeyChallengeRepository,
  RefreshSessionRepository,
  SecurityEventRepository
} from '../../../../src/modules/auth/application/index.js';
import { IssueAuthTokensUseCase } from '../../../../src/modules/auth/application/index.js';

describe('CompletePasskeySignupUseCase', () => {
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

  const signupTransaction: PasskeySignupTransaction = {
    createUserWithPasskeyCredential: vi.fn()
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

  const issueAuthTokens = new IssueAuthTokensUseCase(
      {
        signAccessToken: vi.fn().mockResolvedValue('access-token'),
        signRefreshToken: vi.fn().mockResolvedValue('refresh-token'),
        verifyAccessToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      },
      refreshSessions
  );

  const context = { ip: '127.0.0.1', userAgent: 'vitest' };

  const useCase = new CompletePasskeySignupUseCase(
      challenges,
      passkey,
      signupTransaction,
      issueAuthTokens,
      securityEvents
  );

  const mockChallenge = {
    id: 'ch-id-1',
    challenge: 'ch-val-123',
    type: 'SIGNUP' as const,
    userId: 'pre-generated-uuid',
    email: 'bob@example.com',
    name: 'Bob',
    expiresAt: new Date(Date.now() + 60000),
    createdAt: new Date()
  };

  const mockCredentialData = {
    credentialId: 'cred-bob-1',
    publicKey: Buffer.from('public-key-bytes'),
    counter: '0',
    transports: ['internal'],
    backedUp: true
  };

  it('completes passkey signup atomically and issues tokens', async () => {
    vi.mocked(challenges.consume).mockResolvedValueOnce(mockChallenge);
    vi.mocked(passkey.verifyRegistration).mockResolvedValueOnce(mockCredentialData);

    const createdUser = {
      id: 'pre-generated-uuid',
      email: 'bob@example.com',
      name: 'Bob',
      emailVerified: true
    };

    vi.mocked(signupTransaction.createUserWithPasskeyCredential).mockResolvedValueOnce(createdUser);

    const result = await useCase.execute(
        {
          challenge: 'ch-val-123',
          response: { id: 'cred-bob-1' }
        },
        context
    );

    expect(result.user).toEqual(createdUser);
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');

    expect(challenges.consume).toHaveBeenCalledWith({
      challenge: 'ch-val-123',
      type: 'SIGNUP'
    });

    expect(passkey.verifyRegistration).toHaveBeenCalledWith({
      response: { id: 'cred-bob-1' },
      expectedChallenge: 'ch-val-123'
    });

    expect(signupTransaction.createUserWithPasskeyCredential).toHaveBeenCalledWith({
      userId: 'pre-generated-uuid',
      email: 'bob@example.com',
      name: 'Bob',
      credential: mockCredentialData
    });

    expect(securityEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'pre-generated-uuid',
          eventType: 'REGISTER_SUCCESS',
          metadata: { method: 'passkey' }
        })
    );
  });

  it('throws AppError 400 when challenge is invalid or expired', async () => {
    vi.mocked(challenges.consume).mockResolvedValueOnce(null);

    await expect(
        useCase.execute(
            {
              challenge: 'non-existing-ch',
              response: { id: 'cred' }
            },
            context
        )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid or expired Passkey challenge'
    });

    expect(passkey.verifyRegistration).not.toHaveBeenCalled();
  });

  it('throws AppError 400 when challenge is missing signup fields', async () => {
    vi.mocked(challenges.consume).mockResolvedValueOnce({
      ...mockChallenge,
      userId: null,
      email: null
    });

    await expect(
        useCase.execute(
            {
              challenge: 'ch-val-123',
              response: { id: 'cred' }
            },
            context
        )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid Passkey signup challenge'
    });
  });

  it('throws AppError 400 when passkey verification returns null', async () => {
    vi.mocked(challenges.consume).mockResolvedValueOnce(mockChallenge);
    vi.mocked(passkey.verifyRegistration).mockResolvedValueOnce(null);

    await expect(
        useCase.execute(
            {
              challenge: 'ch-val-123',
              response: { id: 'bad-response' }
            },
            context
        )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Passkey verification failed'
    });

    expect(signupTransaction.createUserWithPasskeyCredential).not.toHaveBeenCalled();
  });
});