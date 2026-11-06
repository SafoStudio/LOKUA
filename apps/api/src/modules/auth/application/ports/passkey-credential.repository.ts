export interface PasskeyCredential {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: Buffer;
  counter: string;
  transports: string[] | null;
  backedUp: boolean;
}

export interface PasskeyCredentialRepository {
  findByCredentialId(credentialId: string): Promise<PasskeyCredential | null>;

  findByUserId(userId: string): Promise<PasskeyCredential[]>;

  create(data: Omit<PasskeyCredential, 'id'>): Promise<void>;

  updateCounter(credentialId: string, counter: string): Promise<void>;

  delete(credentialId: string): Promise<void>;
}
