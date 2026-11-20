import type { DataSource, EntityManager } from 'typeorm';
import type { TransactionContext, UnitOfWork } from '../types/unit-of-work.js';

export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  async run<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) =>
      fn(manager as unknown as TransactionContext)
    );
  }
}

export function toEntityManager(tx: TransactionContext): EntityManager {
  return tx as unknown as EntityManager;
}
