import type { TransactionContext } from '../../../../common/index.js';

export interface UserBlockProvider {
  listRelatedUserIds(userId: string, tx?: TransactionContext): Promise<string[]>;
}
