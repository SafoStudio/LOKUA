export interface EmailService {
  sendVerificationEmail(params: { to: string; name: string; token: string }): Promise<void>;
  sendPasswordResetEmail(params: { to: string; name: string; token: string }): Promise<void>;
}
