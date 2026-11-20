import type { AuditEntry } from '../types/audit-entry.js';
import type { TransactionContext } from '../../../../common/index.js';

export interface AuditLogger {
  log(entry: AuditEntry, tx?: TransactionContext): Promise<void>;
}
