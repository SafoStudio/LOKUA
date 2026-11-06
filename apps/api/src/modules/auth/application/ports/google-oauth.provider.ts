export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export interface GoogleOAuthProvider {
  buildAuthUrl(state: string): string;

  exchangeCode(code: string): Promise<GoogleProfile>;
}
