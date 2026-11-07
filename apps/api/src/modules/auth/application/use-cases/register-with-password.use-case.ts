import type { AuthUser } from '../../domain/index.js';
import type { UserProvider } from '../ports/user.provider.js';
import type { PasswordHasher } from '../ports/password-hasher.js';
import type { RegistrationTransaction } from '../ports/registration-transaction.js';
import { AppError } from '../../../../common/index.js';
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
    private readonly registrationTransaction: RegistrationTransaction
  ) {}

  async execute(input: RegisterWithPasswordInput): Promise<AuthUser> {
    const email = input.email.trim().toLowerCase();

    const existingUser = await this.users.findByEmail(email);

    if (existingUser) throw new AppError('Email already registered', 409);

    validatePasswordLength(input.password);
    const passwordHash = await this.passwordHasher.hash(input.password);

    return this.registrationTransaction.createUserWithPasswordCredential({
      email,
      name: input.name.trim(),
      passwordHash
    });
  }
}
