import type { Repository } from 'typeorm';
import { In } from 'typeorm';
import type { Interest, InterestProvider } from '../../../application/index.js';
import type { InterestEntity } from '../entities/interest.entity.js';
import type { AdminDictionaryStore, InterestInput } from '../../../application/admin-dictionary.js';
import { mapDictionaryConflict } from './dictionary-conflict.js';

export class InterestRepositoryAdapter
  implements InterestProvider, AdminDictionaryStore<Interest, InterestInput>
{
  constructor(private readonly repo: Repository<InterestEntity>) {}

  async findById(id: string): Promise<Interest | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findActiveByIds(ids: string[]): Promise<Interest[]> {
    if (ids.length === 0) return [];
    const entities = await this.repo.find({
      where: { id: In(ids), is_active: true }
    });
    return entities.map((e) => this.toDomain(e));
  }

  async listActive(): Promise<Interest[]> {
    const entities = await this.repo.find({
      where: { is_active: true },
      order: { name: 'ASC', id: 'ASC' }
    });
    return entities.map((e) => this.toDomain(e));
  }

  async listAll(): Promise<Interest[]> {
    const entities = await this.repo.find({ order: { name: 'ASC', id: 'ASC' } });
    return entities.map((entity) => this.toDomain(entity));
  }

  async insert({ name, isActive }: InterestInput): Promise<Interest> {
    const record = this.repo.create({ name, is_active: isActive ?? true });
    const saved = await mapDictionaryConflict(this.repo.save(record));
    return this.toDomain(saved);
  }

  async patch(id: string, { name, isActive }: Partial<InterestInput>): Promise<Interest | null> {
    const write = this.repo
      .createQueryBuilder()
      .update()
      .set({ name, is_active: isActive })
      .where('id = :id', { id })
      .returning('*')
      .execute();
    const result = await mapDictionaryConflict(write);
    const [row] = result.raw as InterestEntity[];
    return row ? this.toDomain(row) : null;
  }

  private toDomain(entity: InterestEntity): Interest {
    return {
      id: entity.id,
      name: entity.name,
      isActive: entity.is_active
    };
  }
}
