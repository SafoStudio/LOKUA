import type { Repository } from 'typeorm';
import type { PasskeyCredentialRepository, PasskeyCredential } from '../../../application/index.js';
import type { PasskeyCredentialEntity } from '../entities/passkey-credential.entity.js';

export class PasskeyCredentialRepositoryAdapter implements PasskeyCredentialRepository {
  constructor(private readonly repository: Repository<PasskeyCredentialEntity>) {}

  async findByCredentialId(credentialId: string): Promise<PasskeyCredential | null> {
    const entity = await this.repository.findOne({
      where: { credentialId }
    });

    return entity ? this.toDomain(entity) : null;
  }

  async findByUserId(userId: string): Promise<PasskeyCredential[]> {
    const entities = await this.repository.find({
      where: { userId }
    });

    return entities.map((entity) => this.toDomain(entity));
  }

  async create(data: Omit<PasskeyCredential, 'id'>): Promise<void> {
    const entity = this.repository.create(data);
    await this.repository.save(entity);
  }

  async updateCounter(credentialId: string, counter: string): Promise<void> {
    await this.repository.update({ credentialId }, { counter });
  }

  async delete(credentialId: string): Promise<void> {
    await this.repository.delete({ credentialId });
  }

  private toDomain(entity: PasskeyCredentialEntity): PasskeyCredential {
    return {
      id: entity.id,
      userId: entity.userId,
      credentialId: entity.credentialId,
      publicKey: entity.publicKey,
      counter: entity.counter,
      transports: entity.transports,
      backedUp: entity.backedUp
    };
  }
}
