import type { AuthUser } from '../../domain/index.js';

export interface UserProvider {
  findById(id: string): Promise<AuthUser | null>;

  findByEmail(email: string): Promise<AuthUser | null>;

  create(data: { email: string; name: string; emailVerified?: boolean }): Promise<AuthUser>;

  markEmailVerified(id: string): Promise<void>;
}
