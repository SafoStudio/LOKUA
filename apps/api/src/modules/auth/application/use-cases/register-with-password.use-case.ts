import type { AuthUser } from '../../domain/index.js';
import type { UserProvider } from '../ports/user.provider.js';
import type { PasswordHasher } from '../ports/password-hasher.js';
import type { RegistrationTransaction } from '../ports/registration-transaction.js';
import type { SecurityEventRepository } from '../ports/security-event.repository.js';
import type { SecurityContext } from '../security-context.js';
import type { SendVerificationEmailUseCase } from './send-verification-email.use-case.js';
import { AppError, logger } from '../../../../common/index.js';
import { validatePasswordLength } from '../validation/password.validation.js';

export interface RegisterWithPasswordInput {
  email: string;
  name: string;
  password: string;
}

export class RegisterWithPasswordUseCase {
  constructor(
    private readonly users: UserProvider,
    private readonly passwordHasher: PasswordHasher,
    private readonly registrationTransaction: RegistrationTransaction,
    private readonly sendVerificationEmail: SendVerificationEmailUseCase,
    private readonly securityEvents: SecurityEventRepository
  ) {}

  async execute(input: RegisterWithPasswordInput, context: SecurityContext): Promise<AuthUser> {
    const email = input.email.trim().toLowerCase();

    const existingUser = await this.users.findByEmail(email);

    if (existingUser) throw new AppError('Email already registered', 409);

    validatePasswordLength(input.password);
    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = await this.registrationTransaction.createUserWithPasswordCredential({
      email,
      name: input.name.trim(),
      passwordHash
    });

    try {
      await this.sendVerificationEmail.execute(user.id);
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to send verification email');
    }

    await this.securityEvents.record({
      userId: user.id,
      eventType: 'REGISTER_SUCCESS',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { method: 'password' }
    });

    return user;
  }
}
