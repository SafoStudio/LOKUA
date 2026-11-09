import { describe, it, expect, vi } from 'vitest';
import { RegisterWithPasswordUseCase } from '../../../../src/modules/auth/application/index.js';
import type { UserProvider } from '../../../../src/modules/auth/index.js';
import type {
  PasswordHasher,
  RegistrationTransaction,
  SecurityEventRepository,
  SendVerificationEmailUseCase
} from '../../../../src/modules/auth/application/index.js';

describe('RegisterWithPasswordUseCase', () => {
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

  const registrationTransaction: RegistrationTransaction = {
    createUserWithPasswordCredential: vi.fn()
  };

  const sendVerificationEmail = {
    execute: vi.fn()
  } as unknown as SendVerificationEmailUseCase;

  const securityEvents: SecurityEventRepository = {
    record: vi.fn()
  };

  const context = { ip: '127.0.0.1', userAgent: 'vitest' };

  const useCase = new RegisterWithPasswordUseCase(
      users,
      passwordHasher,
      registrationTransaction,
      sendVerificationEmail,
      securityEvents
  );

  it('registers user successfully with normalized email and trimmed name', async () => {
    vi.mocked(users.findByEmail).mockResolvedValueOnce(null);
    vi.mocked(passwordHasher.hash).mockResolvedValueOnce('hashed-password');
    vi.mocked(registrationTransaction.createUserWithPasswordCredential).mockResolvedValueOnce({
      id: 'user-1',
      email: 'john@example.com',
      name: 'John Doe',
      emailVerified: false
    });
    vi.mocked(sendVerificationEmail.execute).mockResolvedValueOnce();

    const result = await useCase.execute(
        {
          email: '  John@Example.COM  ',
          name: '  John Doe  ',
          password: 'StrongPassword123'
        },
        context
    );

    expect(result).toEqual({
      id: 'user-1',
      email: 'john@example.com',
      name: 'John Doe',
      emailVerified: false
    });

    expect(users.findByEmail).toHaveBeenCalledWith('john@example.com');
    expect(passwordHasher.hash).toHaveBeenCalledWith('StrongPassword123');
    expect(registrationTransaction.createUserWithPasswordCredential).toHaveBeenCalledWith({
      email: 'john@example.com',
      name: 'John Doe',
      passwordHash: 'hashed-password'
    });
    expect(sendVerificationEmail.execute).toHaveBeenCalledWith('user-1');
    expect(securityEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          eventType: 'REGISTER_SUCCESS',
          metadata: { method: 'password' }
        })
    );
  });

  it('throws AppError 409 when email already exists', async () => {
    vi.mocked(users.findByEmail).mockResolvedValueOnce({
      id: 'existing-id',
      email: 'john@example.com',
      name: 'Existing John',
      emailVerified: true
    });

    await expect(
        useCase.execute(
            {
              email: 'john@example.com',
              name: 'John',
              password: 'StrongPassword123'
            },
            context
        )
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Email already registered'
    });

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(registrationTransaction.createUserWithPasswordCredential).not.toHaveBeenCalled();
  });

  it('throws AppError 400 when password exceeds 72 bytes', async () => {
    vi.mocked(users.findByEmail).mockResolvedValueOnce(null);

    await expect(
        useCase.execute(
            {
              email: 'john@example.com',
              name: 'John',
              password: 'a'.repeat(73)
            },
            context
        )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Password must not exceed 72 bytes'
    });
  });
});