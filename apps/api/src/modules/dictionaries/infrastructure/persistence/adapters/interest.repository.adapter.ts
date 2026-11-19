import type { Repository } from 'typeorm';
import { In } from 'typeorm';
import type { Interest, InterestProvider } from '../../../application/index.js';
import type { InterestEntity } from '../entities/interest.entity.js';

export class InterestRepositoryAdapter implements InterestProvider {
  constructor(private readonly repo: Repository<InterestEntity>) {}

  async findById(id: string): Promise<Interest | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByIds(ids: string[]): Promise<Interest[]> {
    if (ids.length === 0) return [];
    const entities = await this.repo.find({
      where: { id: In(ids), is_active: true }
    });
    return entities.map((e) => this.toDomain(e));
  }

  async listActive(): Promise<Interest[]> {
    const entities = await this.repo.find({
      where: { is_active: true },
      order: { name: 'ASC' }
    });
    return entities.map((e) => this.toDomain(e));
  }

  private toDomain(entity: InterestEntity): Interest {
    return {
      id: entity.id,
      name: entity.name,
      isActive: entity.is_active
    };
  }
}
