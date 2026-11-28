import { AppError } from '../../../common/index.js';
import type { Category } from './ports/category.provider.js';
import type { Interest } from './ports/interest.provider.js';

export type CategoryInput = Pick<Category, 'name' | 'slug'> &
  Partial<Pick<Category, 'icon' | 'orderNum' | 'isActive'>>;
export type InterestInput = Pick<Interest, 'name'> & Partial<Pick<Interest, 'isActive'>>;

export class DictionaryConflictError extends AppError {
  constructor() {
    super('Такий запис довідника вже існує', 409);
    this.name = 'DictionaryConflictError';
  }
}

export interface AdminDictionaryStore<Item, Input> {
  listAll(): Promise<Item[]>;
  insert(input: Input): Promise<Item>;
  patch(id: string, input: Partial<Input>): Promise<Item | null>;
}

export interface AdminDictionary<Item, Input> {
  list(): Promise<Item[]>;
  create(input: Input): Promise<Item>;
  update(id: string, input: Partial<Input>): Promise<Item>;
}

export function createAdminDictionary<Item, Input>(
  store: AdminDictionaryStore<Item, Input>
): AdminDictionary<Item, Input> {
  return {
    list: () => store.listAll(),
    create: (input) => store.insert(input),
    async update(id, input) {
      const item = await store.patch(id, input);
      if (item === null) throw new AppError('Запис довідника не знайдено', 404);
      return item;
    }
  };
}
