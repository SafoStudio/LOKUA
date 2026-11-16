import type { Repository } from 'typeorm';
import type { City, CityProvider } from '../../../application/index.js';
import type { CityEntity } from '../entities/city.entity.js';

export class CityRepositoryAdapter implements CityProvider {
  constructor(private readonly repo: Repository<CityEntity>) {}

  async findById(id: string): Promise<City | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findBySlug(slug: string): Promise<City | null> {
    const entity = await this.repo.findOne({ where: { slug } });
    return entity ? this.toDomain(entity) : null;
  }

  async listActive(): Promise<City[]> {
    const entities = await this.repo.find({
      where: { is_active: true },
      order: { name: 'ASC' }
    });
    return entities.map((e) => this.toDomain(e));
  }

  private toDomain(entity: CityEntity): City {
    return {
      id: entity.id,
      countryCode: entity.country_code,
      name: entity.name,
      slug: entity.slug,
      latitude: entity.latitude,
      longitude: entity.longitude,
      bbox: entity.bbox,
      timezone: entity.timezone,
      isActive: entity.is_active
    };
  }
}
