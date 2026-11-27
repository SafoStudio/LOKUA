import type { TransactionContext } from '../../../../common/index.js';
import type { AuthUser, UserRole, UserStatus } from '../../domain/index.js';

export interface AuthUserProvider {
  findById(id: string, tx?: TransactionContext): Promise<AuthUser | null>;
  findByEmail(email: string): Promise<AuthUser | null>;
  create(
    data: {
      id?: string;
      email: string;
      name: string;
      emailVerified?: boolean;
      role?: UserRole;
      status?: UserStatus;
      termsAcceptedAt?: Date;
    },
    tx?: TransactionContext
  ): Promise<AuthUser>;
  markEmailVerified(id: string): Promise<void>;
}
