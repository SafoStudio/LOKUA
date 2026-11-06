import type { Repository } from 'typeorm';
import type { GoogleCredentialRepository, GoogleCredential } from '../../../application/index.js';
import type { GoogleCredentialEntity } from '../entities/google-credential.entity.js';

export class GoogleCredentialRepositoryAdapter implements GoogleCredentialRepository {
  constructor(private readonly repository: Repository<GoogleCredentialEntity>) {}

  async findByGoogleSub(googleSub: string): Promise<GoogleCredential | null> {
    const entity = await this.repository.findOne({
      where: { googleSub }
    });

    if (!entity) return null;

    return {
      userId: entity.userId,
      googleSub: entity.googleSub
    };
  }

  async create(data: GoogleCredential): Promise<void> {
    const entity = this.repository.create(data);
    await this.repository.save(entity);
  }
}
