import type { Repository } from 'typeorm';
import type {
  PasswordCredentialRepository,
  PasswordCredential
} from '../../../application/index.js';
import type { PasswordCredentialEntity } from '../entities/password-credential.entity.js';

export class PasswordCredentialRepositoryAdapter implements PasswordCredentialRepository {
  constructor(private readonly repository: Repository<PasswordCredentialEntity>) {}

  async findByUserId(userId: string): Promise<PasswordCredential | null> {
    const entity = await this.repository.findOne({
      where: { userId }
    });

    if (!entity) return null;

    return {
      userId: entity.userId,
      passwordHash: entity.passwordHash
    };
  }

  async create(data: PasswordCredential): Promise<void> {
    const entity = this.repository.create(data);
    await this.repository.save(entity);
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.repository.update({ userId }, { passwordHash });
  }
}
