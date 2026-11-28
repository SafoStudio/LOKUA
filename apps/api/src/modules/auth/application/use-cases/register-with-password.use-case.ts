import type { AuthUser } from '../../../users/index.js';
import type { AuthUserProvider } from '../../../users/index.js';
import type { PasswordHasher } from '../ports/password-hasher.js';
import type { RegistrationTransaction } from '../ports/registration-transaction.js';
import type { SecurityEventRepository } from '../ports/security-event.repository.js';
import type { SecurityContext } from '../security-context.js';
import type { SendVerificationEmailUseCase } from './send-verification-email.use-case.js';
import { AppError } from '../../../../common/index.js';
import { sendSignupVerification } from './send-verification-email.use-case.js';
import { validatePasswordLength } from '../validation/password.validation.js';

export interface RegisterWithPasswordInput {
  email: string;
  name: string;
  password: string;
  termsAccepted: true;
}

export class RegisterWithPasswordUseCase {
  constructor(
    private readonly users: AuthUserProvider,
    private readonly passwordHasher: PasswordHasher,
    private readonly registrationTransaction: RegistrationTransaction,
    private readonly sendVerificationEmail: SendVerificationEmailUseCase,
    private readonly securityEvents: SecurityEventRepository
  ) {}

  async execute(input: RegisterWithPasswordInput, context: SecurityContext): Promise<AuthUser> {
    if (input.termsAccepted !== true)
      throw new AppError('Потрібно прийняти умови та політику конфіденційності', 400);
    const email = input.email.trim().toLowerCase();

    const existingUser = await this.users.findByEmail(email);

    if (existingUser) throw new AppError('Email already registered', 409);

    validatePasswordLength(input.password);
    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = await this.registrationTransaction.createUserWithPasswordCredential({
      email,
      name: input.name.trim(),
      passwordHash,
      termsAcceptedAt: new Date()
    });

    await sendSignupVerification(this.sendVerificationEmail, user.id);

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
