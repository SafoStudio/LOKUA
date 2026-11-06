export interface PasswordCredential {
  userId: string;
  passwordHash: string;
}

export interface PasswordCredentialRepository {
  findByUserId(userId: string): Promise<PasswordCredential | null>;

  create(data: PasswordCredential): Promise<void>;
}
