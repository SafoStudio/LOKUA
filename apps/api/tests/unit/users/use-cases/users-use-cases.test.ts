import { describe, it, expect, vi } from 'vitest';
import {
  CreateUserUseCase,
  FindUserByIdUseCase,
  FindUserByEmailUseCase
} from '../../../../src/modules/users/application/index.js';
import type { UserRepository } from '../../../../src/modules/users/application/index.js';
import type { User } from '../../../../src/modules/users/domain/index.js';

describe('Users Use Cases', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'user@example.com',
    name: 'Test User',
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockRepo: UserRepository = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    markEmailVerified: vi.fn()
  };

  it('CreateUserUseCase delegates creation to repository', async () => {
    vi.mocked(mockRepo.create).mockResolvedValueOnce(mockUser);
    const useCase = new CreateUserUseCase(mockRepo);

    const result = await useCase.execute({
      email: 'user@example.com',
      name: 'Test User'
    });

    expect(result).toEqual(mockUser);
    expect(mockRepo.create).toHaveBeenCalledWith({
      email: 'user@example.com',
      name: 'Test User'
    });
  });

  it('FindUserByIdUseCase returns user or null', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValueOnce(mockUser);
    const useCase = new FindUserByIdUseCase(mockRepo);

    const result = await useCase.execute('user-123');
    expect(result).toEqual(mockUser);
    expect(mockRepo.findById).toHaveBeenCalledWith('user-123');

    vi.mocked(mockRepo.findById).mockResolvedValueOnce(null);
    const notFound = await useCase.execute('unknown');
    expect(notFound).toBeNull();
  });

  it('FindUserByEmailUseCase returns user or null', async () => {
    vi.mocked(mockRepo.findByEmail).mockResolvedValueOnce(mockUser);
    const useCase = new FindUserByEmailUseCase(mockRepo);

    const result = await useCase.execute('user@example.com');
    expect(result).toEqual(mockUser);
    expect(mockRepo.findByEmail).toHaveBeenCalledWith('user@example.com');

    vi.mocked(mockRepo.findByEmail).mockResolvedValueOnce(null);
    const notFound = await useCase.execute('unknown@example.com');
    expect(notFound).toBeNull();
  });
});
