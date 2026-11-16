import type { AuthUser, User } from '../../../domain/index.js';
import type { AuthUserProvider, UserRepository } from '../../../application/index.js';

export class AuthUserProviderAdapter implements AuthUserProvider {
  constructor(private readonly repository: UserRepository) {}

  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.repository.findById(id);
    return user ? this.toAuthUser(user) : null;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.repository.findByEmail(email);
    return user ? this.toAuthUser(user) : null;
  }

  async create(data: { email: string; name: string; emailVerified?: boolean }): Promise<AuthUser> {
    const user = await this.repository.create({
      email: data.email,
      name: data.name,
      emailVerified: data.emailVerified ?? false
    });
    return this.toAuthUser(user);
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.repository.markEmailVerified(id);
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified
    };
  }
}
