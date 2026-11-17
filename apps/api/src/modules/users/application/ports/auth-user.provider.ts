import type { AuthUser, UserRole, UserStatus } from '../../domain/index.js';

export interface AuthUserProvider {
  findById(id: string): Promise<AuthUser | null>;
  findByEmail(email: string): Promise<AuthUser | null>;
  create(data: {
    email: string;
    name: string;
    emailVerified?: boolean;
    role?: UserRole;
    status?: UserStatus;
  }): Promise<AuthUser>;
  markEmailVerified(id: string): Promise<void>;
}
