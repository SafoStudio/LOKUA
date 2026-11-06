import type { AuthUser } from '../../domain/index.js';

export interface PasskeySignupTransaction {
  createUserWithPasskeyCredential(data: {
    userId: string;
    email: string;
    name: string;
    credential: {
      credentialId: string;
      publicKey: Buffer;
      counter: string;
      transports: string[] | null;
      backedUp: boolean;
    };
  }): Promise<AuthUser>;
}
