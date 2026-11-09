import type { AuthUser } from '../../domain/index.js';
import type { UserProvider } from '../ports/user.provider.js';
import type { PasswordHasher } from '../ports/password-hasher.js';
import type { PasswordCredentialRepository } from '../ports/password-credential.repository.js';
import type { SecurityEventRepository } from '../ports/security-event.repository.js';
import { AppError } from '../../../../common/index.js';
import { validatePasswordLength } from '../validation/password.validation.js';
import type { SecurityContext } from '../security-context.js';

export interface LoginWithPasswordInput {
  email: string;
  password: string;
}

export class LoginWithPasswordUseCase {
  constructor(
    private readonly users: UserProvider,
    private readonly passwordHasher: PasswordHasher,
    private readonly credentials: PasswordCredentialRepository,
    private readonly securityEvents: SecurityEventRepository
  ) {}

  async execute(input: LoginWithPasswordInput, context: SecurityContext): Promise<AuthUser> {
    const email = input.email.trim().toLowerCase();

    const user = await this.users.findByEmail(email);

    if (!user) {
      await this.securityEvents.record({
        userId: null,
        eventType: 'LOGIN_FAILURE',
        ip: context.ip,
        userAgent: context.userAgent
      });
      throw new AppError('Invalid credentials', 401);
    }

    const credential = await this.credentials.findByUserId(user.id);

    if (!credential) {
      await this.securityEvents.record({
        userId: user.id,
        eventType: 'LOGIN_FAILURE',
        ip: context.ip,
        userAgent: context.userAgent
      });
      throw new AppError('Invalid credentials', 401);
    }

    validatePasswordLength(input.password);
    const valid = await this.passwordHasher.compare(input.password, credential.passwordHash);

    if (!valid) {
      await this.securityEvents.record({
        userId: user.id,
        eventType: 'LOGIN_FAILURE',
        ip: context.ip,
        userAgent: context.userAgent
      });
      throw new AppError('Invalid credentials', 401);
    }

    await this.securityEvents.record({
      userId: user.id,
      eventType: 'LOGIN_SUCCESS',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { method: 'password' }
    });

    return user;
  }
}
