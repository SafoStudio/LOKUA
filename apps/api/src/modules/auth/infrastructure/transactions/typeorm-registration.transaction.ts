import type { DataSource } from 'typeorm';
import type { AuthUser } from '../../../users/index.js';
import type { RegistrationTransaction } from '../../application/index.js';
import { AppError, isUniqueConstraintViolation } from '../../../../common/index.js';
import { UserEntity, UserRepositoryAdapter } from '../../../users/infrastructure/index.js';
import { PasswordCredentialEntity, PasswordCredentialRepositoryAdapter } from '../index.js';
import { toAuthUser } from './to-auth-user.mapper.js';

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

        return toAuthUser(user);
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new AppError('Email already registered', 409);
      }
      throw error;
    }
  }
}
