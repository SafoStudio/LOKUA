export interface GoogleCredential {
  userId: string;
  googleSub: string;
}

export interface GoogleCredentialRepository {
  findByGoogleSub(googleSub: string): Promise<GoogleCredential | null>;

  create(data: GoogleCredential): Promise<void>;
}
