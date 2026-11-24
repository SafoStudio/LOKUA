import type { TransactionContext } from '../../../../common/index.js';
import type { DataSource } from 'typeorm';
import type { AuthUser, AuthUserProvider } from '../../../users/index.js';
import type { RegistrationTransaction } from '../../application/index.js';
import { AppError, isUniqueConstraintViolation } from '../../../../common/index.js';
import { PasswordCredentialEntity, PasswordCredentialRepositoryAdapter } from '../index.js';

export class TypeOrmRegistrationTransaction implements RegistrationTransaction {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: AuthUserProvider
  ) {}

  async createUserWithPasswordCredential(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<AuthUser> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const credentialRepository = new PasswordCredentialRepositoryAdapter(
          manager.getRepository(PasswordCredentialEntity)
        );

        const user = await this.users.create(
          {
            email: data.email,
            name: data.name
          },
          manager as unknown as TransactionContext
        );

        await credentialRepository.create({
          userId: user.id,
          passwordHash: data.passwordHash
        });

        return user;
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new AppError('Email already registered', 409);
      }
      throw error;
    }
  }
}
