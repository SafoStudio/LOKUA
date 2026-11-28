export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export interface GoogleOAuthProvider {
  buildAuthUrl(state: string, verifier: string): string;

  exchangeCode(code: string, verifier?: string): Promise<GoogleProfile>;
}
