import type { DataSource } from 'typeorm';
import type { AuthUser } from '../modules/auth/domain/index.js';
import type { RegistrationTransaction } from '../modules/auth/application/index.js';
import { AppError } from '../common/errors/app-error.js';
import { UserEntity, UserRepositoryAdapter } from '../modules/users/infrastructure/index.js';
import {
  PasswordCredentialEntity,
  PasswordCredentialRepositoryAdapter
} from '../modules/auth/infrastructure/index.js';

function isUniqueConstraintViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const driverError = 'driverError' in error ? error.driverError : error;

  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === '23505'
  );
}

export class TypeOrmRegistrationTransaction implements RegistrationTransaction {
  constructor(private readonly dataSource: DataSource) {}

  async createUserWithPasswordCredential(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<AuthUser> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const userRepository = new UserRepositoryAdapter(manager.getRepository(UserEntity));

        const credentialRepository = new PasswordCredentialRepositoryAdapter(
          manager.getRepository(PasswordCredentialEntity)
        );

        const user = await userRepository.create({
          email: data.email,
          name: data.name
        });

        await credentialRepository.create({
          userId: user.id,
          passwordHash: data.passwordHash
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified
        };
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new AppError('Email already registered', 409);
      }

      throw error;
    }
  }
}
