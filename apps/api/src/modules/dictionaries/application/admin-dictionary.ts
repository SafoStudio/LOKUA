import { AppError, isUniqueConstraintViolation } from '../../../common/index.js';
import type { Category, Interest } from './index.js';

export type CategoryInput = Pick<Category, 'name' | 'slug'> &
  Partial<Pick<Category, 'icon' | 'orderNum' | 'isActive'>>;
export type InterestInput = Pick<Interest, 'name'> & Partial<Pick<Interest, 'isActive'>>;

export interface AdminDictionaryStore<Item, Input> {
  listAll(): Promise<Item[]>;
  insert(input: Input): Promise<Item>;
  patch(id: string, input: Partial<Input>): Promise<Item | null>;
}

export function createAdminDictionary<Item, Input>(store: AdminDictionaryStore<Item, Input>) {
  async function write(operation: Promise<Item | null>) {
    try {
      const result = await operation;
      if (result === null) throw new AppError('Запис довідника не знайдено', 404);
      return result;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new AppError('Такий запис довідника вже існує', 409);
      }
      throw error;
    }
  }

  return {
    list: () => store.listAll(),
    create: (input: Input) => write(store.insert(input)),
    update: (id: string, input: Partial<Input>) => write(store.patch(id, input))
  };
}
