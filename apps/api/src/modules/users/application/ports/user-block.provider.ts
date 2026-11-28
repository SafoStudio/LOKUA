import type { TransactionContext } from '../../../../common/index.js';

export interface UserBlockProvider {
  listRelatedUserIds(userId: string, tx?: TransactionContext): Promise<string[]>;
  listBlockerIds(userId: string, tx?: TransactionContext): Promise<string[]>;
  listBlockedIds(userId: string, tx?: TransactionContext): Promise<string[]>;
}
