import type { Repository } from 'typeorm';
import { toEntityManager } from '../../../../../common/index.js';
import type { TransactionContext } from '../../../../../common/index.js';
import type { Category, CategoryProvider } from '../../../application/index.js';
import { CategoryEntity } from '../entities/category.entity.js';
import type { AdminDictionaryStore, CategoryInput } from '../../../application/admin-dictionary.js';
import { mapDictionaryConflict } from './dictionary-conflict.js';

export class CategoryRepositoryAdapter
  implements CategoryProvider, AdminDictionaryStore<Category, CategoryInput>
{
  constructor(private readonly repo: Repository<CategoryEntity>) {}

  async findById(id: string, tx?: TransactionContext): Promise<Category | null> {
    const repo = tx ? toEntityManager(tx).getRepository(CategoryEntity) : this.repo;
    const entity = await repo.findOne({
      where: { id },
      ...(tx ? { lock: { mode: 'pessimistic_read' as const } } : {})
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const entity = await this.repo.findOne({ where: { slug } });
    return entity ? this.toDomain(entity) : null;
  }

  async listActive(): Promise<Category[]> {
    const entities = await this.repo.find({
      where: { is_active: true },
      order: { order_num: 'ASC', name: 'ASC', id: 'ASC' }
    });
    return entities.map((e) => this.toDomain(e));
  }

  async listAll(): Promise<Category[]> {
    const entities = await this.repo.find({ order: { order_num: 'ASC', name: 'ASC', id: 'ASC' } });
    return entities.map((entity) => this.toDomain(entity));
  }

  async insert({ orderNum, isActive, ...fields }: CategoryInput): Promise<Category> {
    const record = this.repo.create({
      ...fields,
      icon: fields.icon ?? null,
      order_num: orderNum ?? 0,
      is_active: isActive ?? true
    });
    const saved = await mapDictionaryConflict(this.repo.save(record));
    return this.toDomain(saved);
  }

  async patch(
    id: string,
    { orderNum, isActive, ...fields }: Partial<CategoryInput>
  ): Promise<Category | null> {
    const write = this.repo
      .createQueryBuilder()
      .update()
      .set({ ...fields, order_num: orderNum, is_active: isActive })
      .where('id = :id', { id })
      .returning('*')
      .execute();
    const result = await mapDictionaryConflict(write);
    const [row] = result.raw as CategoryEntity[];
    return row ? this.toDomain(row) : null;
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
