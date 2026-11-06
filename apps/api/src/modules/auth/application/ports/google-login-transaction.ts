import type { AuthUser } from '../../domain/index.js';

export interface GoogleLoginTransaction {
  createUserWithGoogleCredential(data: {
    email: string;
    name: string;
    googleSub: string;
  }): Promise<AuthUser>;
}
