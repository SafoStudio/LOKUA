export interface PasskeyCredentialData {
  credentialId: string;
  publicKey: Buffer;
  counter: string;
  transports: string[] | null;
  backedUp: boolean;
}

export interface PasskeyVerificationService {
  generateRegistrationOptions(data: {
    userId: string;
    email: string;
    name: string;
    existingCredentials: Array<{
      credentialId: string;
      transports: string[] | null;
    }>;
  }): Promise<{
    challenge: string;
    options: unknown;
  }>;

  verifyRegistration(data: {
    response: unknown;
    expectedChallenge: string;
  }): Promise<PasskeyCredentialData | null>;

  generateAuthenticationOptions(): Promise<{
    challenge: string;
    options: unknown;
  }>;

  verifyAuthentication(data: {
    response: unknown;
    expectedChallenge: string;
    credential: {
      credentialId: string;
      publicKey: Buffer;
      counter: string;
      transports: string[] | null;
    };
  }): Promise<{
    newCounter: string;
  } | null>;
}
