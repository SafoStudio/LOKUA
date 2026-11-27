import type { TransactionContext } from '../../../../common/index.js';
import type { DataSource } from 'typeorm';
import type { AuthUser, AuthUserProvider } from '../../../users/index.js';
import type { GoogleLoginTransaction } from '../../application/index.js';
import { GoogleCredentialEntity, GoogleCredentialRepositoryAdapter } from '../index.js';
import { AppError, isUniqueConstraintViolation } from '../../../../common/index.js';

export class TypeOrmGoogleLoginTransaction implements GoogleLoginTransaction {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: AuthUserProvider
  ) {}

  async createUserWithGoogleCredential(data: {
    email: string;
    name: string;
    termsAcceptedAt?: Date;
    googleSub: string;
  }): Promise<AuthUser> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const credentialRepository = new GoogleCredentialRepositoryAdapter(
          manager.getRepository(GoogleCredentialEntity)
        );

        const user = await this.users.create(
          {
            email: data.email,
            termsAcceptedAt: data.termsAcceptedAt,
            name: data.name,
            emailVerified: true
          },
          manager as unknown as TransactionContext
        );

        await credentialRepository.create({
          userId: user.id,
          googleSub: data.googleSub
        });

        return user;
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new AppError('Google account or email is already registered', 409);
      }
      throw error;
    }
  }
}
