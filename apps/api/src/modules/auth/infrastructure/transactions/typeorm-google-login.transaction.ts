import type { DataSource } from 'typeorm';
import type { AuthUser } from '../../domain/index.js';
import type { GoogleLoginTransaction } from '../../application/index.js';

import { UserEntity, UserRepositoryAdapter } from '../../../users/infrastructure/index.js';

import { GoogleCredentialEntity, GoogleCredentialRepositoryAdapter } from '../index.js';

import { AppError } from '../../../../common/errors/app-error.js';

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

export class TypeOrmGoogleLoginTransaction implements GoogleLoginTransaction {
  constructor(private readonly dataSource: DataSource) {}

  async createUserWithGoogleCredential(data: {
    email: string;
    name: string;
    googleSub: string;
  }): Promise<AuthUser> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const userRepository = new UserRepositoryAdapter(manager.getRepository(UserEntity));

        const credentialRepository = new GoogleCredentialRepositoryAdapter(
          manager.getRepository(GoogleCredentialEntity)
        );

        const user = await userRepository.create({
          email: data.email,
          name: data.name,
          emailVerified: true
        });

        await credentialRepository.create({
          userId: user.id,
          googleSub: data.googleSub
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
        throw new AppError('Google account or email is already registered', 409);
      }

      throw error;
    }
  }
}
