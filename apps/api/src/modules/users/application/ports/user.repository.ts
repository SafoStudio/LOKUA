import type { User } from '../../domain/index.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;

  findByEmail(email: string): Promise<User | null>;

  create(data: {
    id?: string;
    email: string;
    name: string;
    emailVerified?: boolean;
  }): Promise<User>;

  markEmailVerified(id: string): Promise<void>;
}
