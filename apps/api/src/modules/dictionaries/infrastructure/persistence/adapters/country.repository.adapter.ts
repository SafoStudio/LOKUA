import type { Repository } from 'typeorm';
import type { Country, CountryProvider } from '../../../application/index.js';
import type { CountryEntity } from '../entities/country.entity.js';

export class CountryRepositoryAdapter implements CountryProvider {
  constructor(private readonly repo: Repository<CountryEntity>) {}

  async findByCode(code: string): Promise<Country | null> {
    const entity = await this.repo.findOne({ where: { code } });
    return entity ? { code: entity.code, name: entity.name } : null;
  }

  async listAll(): Promise<Country[]> {
    const entities = await this.repo.find({ order: { name: 'ASC' } });
    return entities.map((e) => ({ code: e.code, name: e.name }));
  }
}
