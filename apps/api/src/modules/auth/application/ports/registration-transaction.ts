import type { AuthUser } from '../../domain/index.js';

export interface RegistrationTransaction {
  createUserWithPasswordCredential(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<AuthUser>;
}
