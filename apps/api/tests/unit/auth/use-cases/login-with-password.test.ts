import { describe, it, expect, vi } from 'vitest';
import { LoginWithPasswordUseCase } from '../../../../src/modules/auth/application/index.js';
import type { UserProvider } from '../../../../src/modules/auth/index.js';
import type {
  PasswordHasher,
  PasswordCredentialRepository,
  SecurityEventRepository
} from '../../../../src/modules/auth/application/index.js';

describe('LoginWithPasswordUseCase', () => {
  const users: UserProvider = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    markEmailVerified: vi.fn()
  };

  const passwordHasher: PasswordHasher = {
    hash: vi.fn(),
    compare: vi.fn()
  };

  const credentials: PasswordCredentialRepository = {
    findByUserId: vi.fn(),
    create: vi.fn(),
    updatePasswordHash: vi.fn()
  };

  const securityEvents: SecurityEventRepository = {
    record: vi.fn()
  };

  const context = { ip: '127.0.0.1', userAgent: 'vitest' };

  const useCase = new LoginWithPasswordUseCase(
      users,
      passwordHasher,
      credentials,
      securityEvents
  );

  it('authenticates user successfully with valid credentials and normalized email', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      emailVerified: true
    };

    vi.mocked(users.findByEmail).mockResolvedValueOnce(user);
    vi.mocked(credentials.findByUserId).mockResolvedValueOnce({
      userId: 'user-1',
      passwordHash: 'stored-hash'
    });
    vi.mocked(passwordHasher.compare).mockResolvedValueOnce(true);

    const result = await useCase.execute(
        {
          email: '  USER@example.COM  ',
          password: 'ValidPassword123'
        },
        context
    );

    expect(result).toEqual(user);
    expect(users.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(passwordHasher.compare).toHaveBeenCalledWith('ValidPassword123', 'stored-hash');
    expect(securityEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          eventType: 'LOGIN_SUCCESS',
          ip: '127.0.0.1',
          userAgent: 'vitest'
        })
    );
  });

  it('throws AppError 401 when user is not found', async () => {
    vi.mocked(users.findByEmail).mockResolvedValueOnce(null);

    await expect(
        useCase.execute(
            {
              email: 'unknown@example.com',
              password: 'Password123'
            },
            context
        )
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials'
    });

    expect(securityEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          eventType: 'LOGIN_FAILURE'
        })
    );
  });

  it('throws AppError 401 when user has no password credentials (e.g. Google-only account)', async () => {
    vi.mocked(users.findByEmail).mockResolvedValueOnce({
      id: 'google-user',
      email: 'google@example.com',
      name: 'Google User',
      emailVerified: true
    });
    vi.mocked(credentials.findByUserId).mockResolvedValueOnce(null);

    await expect(
        useCase.execute(
            {
              email: 'google@example.com',
              password: 'Password123'
            },
            context
        )
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials'
    });
  });

  it('throws AppError 401 when password comparison returns false', async () => {
    vi.mocked(users.findByEmail).mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      emailVerified: true
    });
    vi.mocked(credentials.findByUserId).mockResolvedValueOnce({
      userId: 'user-1',
      passwordHash: 'stored-hash'
    });
    vi.mocked(passwordHasher.compare).mockResolvedValueOnce(false);

    await expect(
        useCase.execute(
            {
              email: 'user@example.com',
              password: 'WrongPassword'
            },
            context
        )
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials'
    });
  });
});