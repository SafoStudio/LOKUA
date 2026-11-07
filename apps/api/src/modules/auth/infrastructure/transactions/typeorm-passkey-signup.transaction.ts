import type { DataSource } from 'typeorm';
import type { PasskeySignupTransaction } from '../../application/index.js';
import type { AuthUser } from '../../domain/index.js';
import { UserRepositoryAdapter, UserEntity } from '../../../users/infrastructure/index.js';
import { PasskeyCredentialRepositoryAdapter, PasskeyCredentialEntity } from '../index.js';
import { AppError } from '../../../../common/index.js';

export class TypeOrmPasskeySignupTransaction implements PasskeySignupTransaction {
  constructor(private readonly dataSource: DataSource) {}

  async createUserWithPasskeyCredential(data: {
    userId: string;
    email: string;
    name: string;
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
        const userRepository = new UserRepositoryAdapter(manager.getRepository(UserEntity));

        const credentialRepository = new PasskeyCredentialRepositoryAdapter(
          manager.getRepository(PasskeyCredentialEntity)
        );

        const user = await userRepository.create({
          id: data.userId,
          email: data.email,
          name: data.name
        });

        await credentialRepository.create({
          userId: user.id,
          ...data.credential
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified
        };
      });
    } catch (error) {
      const databaseError = error as {
        code?: string;
        constraint?: string;
        driverError?: {
          code?: string;
          constraint?: string;
        };
      };

      const pgError: {
        code?: string;
        constraint?: string;
      } = databaseError.driverError ?? databaseError;

      if (pgError.code === '23505') {
        if (pgError.constraint === 'idx_users_email') {
          throw new AppError('Email already registered', 409);
        }

        if (pgError.constraint === 'idx_passkey_credentials_credential_id') {
          throw new AppError('Passkey already registered', 409);
        }

        throw new AppError('Account or Passkey already exists', 409);
      }

      throw error;
    }
  }
}
