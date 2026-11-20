import type { CreateUserData } from '../types/create-user-data.js';
import type { User } from '../../domain/index.js';
import type { TransactionContext } from '../../../../common/index.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  markEmailVerified(id: string): Promise<void>;
  setBirthDate(id: string, birthDate: Date, tx?: TransactionContext): Promise<User>;
}
