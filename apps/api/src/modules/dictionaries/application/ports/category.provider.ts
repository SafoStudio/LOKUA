import type { TransactionContext } from '../../../../common/index.js';

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  orderNum: number;
  isActive: boolean;
};

export interface CategoryProvider {
  findById(id: string, tx?: TransactionContext): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  listActive(): Promise<Category[]>;
}
