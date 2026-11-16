import type { Repository } from 'typeorm';
import type { Category, CategoryProvider } from '../../../application/index.js';
import type { CategoryEntity } from '../entities/category.entity.js';

export class CategoryRepositoryAdapter implements CategoryProvider {
  constructor(private readonly repo: Repository<CategoryEntity>) {}

  async findById(id: string): Promise<Category | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const entity = await this.repo.findOne({ where: { slug } });
    return entity ? this.toDomain(entity) : null;
  }

  async listActive(): Promise<Category[]> {
    const entities = await this.repo.find({
      where: { is_active: true },
      order: { order_num: 'ASC', name: 'ASC' }
    });
    return entities.map((e) => this.toDomain(e));
  }

  private toDomain(entity: CategoryEntity): Category {
    return {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      icon: entity.icon,
      orderNum: entity.order_num,
      isActive: entity.is_active
    };
  }
}
