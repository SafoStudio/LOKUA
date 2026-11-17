import type { AuthUser } from '../../../users/index.js';

export interface GoogleLoginTransaction {
  createUserWithGoogleCredential(data: {
    email: string;
    name: string;
    googleSub: string;
  }): Promise<AuthUser>;
}
