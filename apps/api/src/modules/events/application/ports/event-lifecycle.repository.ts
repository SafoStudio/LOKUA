import type { TransactionContext } from '../../../../common/index.js';

export interface EventLifecycleRepository {
  advanceDueEvents(now: Date, limit: number, tx: TransactionContext): Promise<number>;
}
