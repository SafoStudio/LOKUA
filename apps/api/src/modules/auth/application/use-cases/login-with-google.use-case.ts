import type { AuthUser } from '../../domain/index.js';
import type { UserProvider } from '../ports/user.provider.js';
import type { GoogleOAuthProvider } from '../ports/google-oauth.provider.js';
import type { GoogleCredentialRepository } from '../ports/google-credential.repository.js';
import type { GoogleLoginTransaction } from '../ports/google-login-transaction.js';
import type { SecurityEventRepository } from '../ports/security-event.repository.js';
import type { SecurityContext } from '../security-context.js';
import { AppError } from '../../../../common/index.js';

export class LoginWithGoogleUseCase {
  constructor(
    private readonly users: UserProvider,
    private readonly google: GoogleOAuthProvider,
    private readonly credentials: GoogleCredentialRepository,
    private readonly googleLoginTransaction: GoogleLoginTransaction,
    private readonly securityEvents: SecurityEventRepository
  ) {}

  async execute(code: string, context: SecurityContext): Promise<AuthUser> {
    const profile = await this.google.exchangeCode(code);

    if (!profile.emailVerified) {
      await this.securityEvents.record({
        userId: null,
        eventType: 'LOGIN_FAILURE',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { method: 'google', reason: 'email_not_verified' }
      });
      throw new AppError('Google email is not verified', 400);
    }

    const existingCredential = await this.credentials.findByGoogleSub(profile.sub);

    if (existingCredential) {
      const user = await this.users.findById(existingCredential.userId);
      if (!user) throw new AppError('User not found', 401);

      await this.securityEvents.record({
        userId: user.id,
        eventType: 'LOGIN_SUCCESS',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { method: 'google' }
      });

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

    const user = await this.googleLoginTransaction.createUserWithGoogleCredential({
      email,
      name: profile.name.trim(),
      googleSub: profile.sub
    });

    await this.securityEvents.record({
      userId: user.id,
      eventType: 'LOGIN_SUCCESS',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { method: 'google', newUser: true }
    });

    return user;
  }
}
