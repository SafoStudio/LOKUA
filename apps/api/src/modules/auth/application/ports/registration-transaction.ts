import type { AuthUser } from '../../../users/index.js';

export interface RegistrationTransaction {
  createUserWithPasswordCredential(data: {
    email: string;
    name: string;
    termsAcceptedAt?: Date;
    passwordHash: string;
  }): Promise<AuthUser>;
}
