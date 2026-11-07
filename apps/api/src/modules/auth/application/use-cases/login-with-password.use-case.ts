import type { AuthUser } from '../../domain/index.js';
import type { UserProvider } from '../ports/user.provider.js';
import type { PasswordHasher } from '../ports/password-hasher.js';
import type { PasswordCredentialRepository } from '../ports/password-credential.repository.js';
import { AppError } from '../../../../common/index.js';
import { validatePasswordLength } from '../validation/password.validation.js';

export interface LoginWithPasswordInput {
  email: string;
  password: string;
}

export class LoginWithPasswordUseCase {
  constructor(
    private readonly users: UserProvider,
    private readonly passwordHasher: PasswordHasher,
    private readonly credentials: PasswordCredentialRepository
  ) {}

  async execute(input: LoginWithPasswordInput): Promise<AuthUser> {
    const email = input.email.trim().toLowerCase();

    const user = await this.users.findByEmail(email);

    if (!user) throw new AppError('Invalid credentials', 401);

    const credential = await this.credentials.findByUserId(user.id);

    if (!credential) throw new AppError('Invalid credentials', 401);

    validatePasswordLength(input.password);
    const valid = await this.passwordHasher.compare(input.password, credential.passwordHash);

    if (!valid) throw new AppError('Invalid credentials', 401);

    return user;
  }
}
