import type { AuthUser } from '../../../users/index.js';

export interface PasskeySignupTransaction {
  createUserWithPasskeyCredential(data: {
    userId: string;
    email: string;
    name: string;
    termsAcceptedAt?: Date;
    credential: {
      credentialId: string;
      publicKey: Buffer;
      counter: string;
      transports: string[] | null;
      backedUp: boolean;
    };
  }): Promise<AuthUser>;
}
