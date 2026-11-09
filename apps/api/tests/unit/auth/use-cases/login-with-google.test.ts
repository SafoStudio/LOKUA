import { describe, it, expect, vi } from 'vitest';
import { LoginWithGoogleUseCase } from '../../../../src/modules/auth/application/index.js';
import type { UserProvider } from '../../../../src/modules/auth/index.js';
import type {
  GoogleOAuthProvider,
  GoogleCredentialRepository,
  GoogleLoginTransaction,
  SecurityEventRepository
} from '../../../../src/modules/auth/application/index.js';

describe('LoginWithGoogleUseCase', () => {
  const users: UserProvider = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    markEmailVerified: vi.fn()
  };

  const google: GoogleOAuthProvider = {
    buildAuthUrl: vi.fn(),
    exchangeCode: vi.fn()
  };

  const credentials: GoogleCredentialRepository = {
    findByGoogleSub: vi.fn(),
    create: vi.fn()
  };

  const googleLoginTransaction: GoogleLoginTransaction = {
    createUserWithGoogleCredential: vi.fn()
  };

  const securityEvents: SecurityEventRepository = {
    record: vi.fn()
  };

  const context = { ip: '127.0.0.1', userAgent: 'vitest' };

  const useCase = new LoginWithGoogleUseCase(
      users,
      google,
      credentials,
      googleLoginTransaction,
      securityEvents
  );

  it('logs in existing Google user found by sub', async () => {
    const existingUser = {
      id: 'user-google-1',
      email: 'alex@gmail.com',
      name: 'Alex',
      emailVerified: true
    };

    vi.mocked(google.exchangeCode).mockResolvedValueOnce({
      sub: 'google-sub-123',
      email: 'alex@gmail.com',
      emailVerified: true,
      name: 'Alex'
    });

    vi.mocked(credentials.findByGoogleSub).mockResolvedValueOnce({
      userId: 'user-google-1',
      googleSub: 'google-sub-123'
    });

    vi.mocked(users.findById).mockResolvedValueOnce(existingUser);

    const result = await useCase.execute('google-code-123', context);

    expect(result).toEqual(existingUser);
    expect(credentials.findByGoogleSub).toHaveBeenCalledWith('google-sub-123');
    expect(users.findById).toHaveBeenCalledWith('user-google-1');
    expect(securityEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-google-1',
          eventType: 'LOGIN_SUCCESS'
        })
    );
  });

  it('creates new user and Google credential when user does not exist', async () => {
    vi.mocked(google.exchangeCode).mockResolvedValueOnce({
      sub: 'new-google-sub',
      email: 'newuser@gmail.com',
      emailVerified: true,
      name: 'New User'
    });

    vi.mocked(credentials.findByGoogleSub).mockResolvedValueOnce(null);
    vi.mocked(users.findByEmail).mockResolvedValueOnce(null);

    const newUser = {
      id: 'new-user-id',
      email: 'newuser@gmail.com',
      name: 'New User',
      emailVerified: true
    };

    vi.mocked(googleLoginTransaction.createUserWithGoogleCredential).mockResolvedValueOnce(newUser);

    const result = await useCase.execute('valid-code', context);

    expect(result).toEqual(newUser);
    expect(googleLoginTransaction.createUserWithGoogleCredential).toHaveBeenCalledWith({
      email: 'newuser@gmail.com',
      name: 'New User',
      googleSub: 'new-google-sub'
    });
    expect(securityEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'new-user-id',
          eventType: 'LOGIN_SUCCESS'
        })
    );
  });

  it('throws AppError 400 when Google email is not verified', async () => {
    vi.mocked(google.exchangeCode).mockResolvedValueOnce({
      sub: 'unverified-sub',
      email: 'unverified@gmail.com',
      emailVerified: false,
      name: 'Unverified'
    });

    await expect(useCase.execute('code', context)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Google email is not verified'
    });

    expect(securityEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          eventType: 'LOGIN_FAILURE'
        })
    );
  });

  it('throws AppError 409 and prevents automatic account linking when email is already registered', async () => {
    vi.mocked(google.exchangeCode).mockResolvedValueOnce({
      sub: 'google-sub-456',
      email: 'registered@example.com',
      emailVerified: true,
      name: 'Registered User'
    });

    vi.mocked(credentials.findByGoogleSub).mockResolvedValueOnce(null);
    vi.mocked(users.findByEmail).mockResolvedValueOnce({
      id: 'pwd-user-id',
      email: 'registered@example.com',
      name: 'Registered User',
      emailVerified: true
    });

    await expect(useCase.execute('code', context)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Email already registered. Log in with password and link Google in settings.'
    });

    expect(googleLoginTransaction.createUserWithGoogleCredential).not.toHaveBeenCalled();
  });
});