import type { TransactionContext } from '../../../../common/index.js';
import type { DataSource } from 'typeorm';
import type { PasskeySignupTransaction } from '../../application/index.js';
import type { AuthUser, AuthUserProvider } from '../../../users/index.js';
import { PasskeyCredentialRepositoryAdapter, PasskeyCredentialEntity } from '../index.js';
import { AppError } from '../../../../common/index.js';

export class TypeOrmPasskeySignupTransaction implements PasskeySignupTransaction {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: AuthUserProvider
  ) {}

  async createUserWithPasskeyCredential(data: {
    userId: string;
    email: string;
    name: string;
    termsAcceptedAt?: Date;
    credential: {
      credentialId: string;
      publicKey: Buffer;
      counter: string;
      transports: string[] | null;
      backedUp: boolean;
    };
  }): Promise<AuthUser> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const credentialRepository = new PasskeyCredentialRepositoryAdapter(
          manager.getRepository(PasskeyCredentialEntity)
        );

        const user = await this.users.create(
          {
            id: data.userId,
            email: data.email,
            termsAcceptedAt: data.termsAcceptedAt,
            name: data.name
          },
          manager as unknown as TransactionContext
        );

        await credentialRepository.create({
          userId: user.id,
          ...data.credential
        });

        return user;
      });
    } catch (error) {
      const databaseError = error as {
        code?: string;
        constraint?: string;
        driverError?: { code?: string; constraint?: string };
      };

      const pgError: { code?: string; constraint?: string } =
        databaseError.driverError ?? databaseError;

      if (pgError.code === '23505') {
        if (pgError.constraint === 'idx_users_email') {
          throw new AppError('Email already registered', 409);
        }
        throw new AppError('Account or Passkey already exists', 409);
      }

      throw error;
    }
  }
}
