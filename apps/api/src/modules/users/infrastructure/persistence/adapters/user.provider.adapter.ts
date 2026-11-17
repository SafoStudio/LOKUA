import type { CreateUserData, UserProvider, UserRepository } from '../../../application/index.js';
import type { User } from '../../../domain/index.js';

export class UserProviderAdapter implements UserProvider {
  constructor(private readonly repository: UserRepository) {}

  async findById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }

  async create(data: CreateUserData): Promise<User> {
    return this.repository.create(data);
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.repository.markEmailVerified(id);
  }
}
