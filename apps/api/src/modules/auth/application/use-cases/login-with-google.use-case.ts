import type { AuthUser } from '../../domain/index.js';
import type { UserProvider } from '../ports/user.provider.js';
import type { GoogleOAuthProvider } from '../ports/google-oauth.provider.js';
import type { GoogleCredentialRepository } from '../ports/google-credential.repository.js';
import type { GoogleLoginTransaction } from '../ports/google-login-transaction.js';
import { AppError } from '../../../../common/errors/app-error.js';

export class LoginWithGoogleUseCase {
  constructor(
    private readonly users: UserProvider,
    private readonly google: GoogleOAuthProvider,
    private readonly credentials: GoogleCredentialRepository,
    private readonly googleLoginTransaction: GoogleLoginTransaction
  ) {}

  async execute(code: string): Promise<AuthUser> {
    const profile = await this.google.exchangeCode(code);

    if (!profile.emailVerified) throw new AppError('Google email is not verified', 400);

    const existingCredential = await this.credentials.findByGoogleSub(profile.sub);

    if (existingCredential) {
      const user = await this.users.findById(existingCredential.userId);
      if (!user) throw new AppError('User not found', 401);
      return user;
    }

    const email = profile.email.trim().toLowerCase();

    const existingUser = await this.users.findByEmail(email);

    if (existingUser) {
      throw new AppError(
        'Email already registered. Log in with password and link Google in settings.',
        409
      );
    }

    return this.googleLoginTransaction.createUserWithGoogleCredential({
      email,
      name: profile.name.trim(),
      googleSub: profile.sub
    });
  }
}
