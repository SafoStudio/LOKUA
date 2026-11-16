import type { AuthUser } from '../../../users/index.js';

export interface RegistrationTransaction {
  createUserWithPasswordCredential(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<AuthUser>;
}
