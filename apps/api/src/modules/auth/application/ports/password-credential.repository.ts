export interface PasswordCredential {
  userId: string;
  passwordHash: string;
}

export interface PasswordCredentialRepository {
  findByUserId(userId: string): Promise<PasswordCredential | null>;

  create(data: PasswordCredential): Promise<void>;

  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
}
