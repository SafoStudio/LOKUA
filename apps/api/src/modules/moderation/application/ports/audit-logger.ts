import type { EntityManager } from 'typeorm';
import type { AuditEntry } from '../types/audit-entry.js';

export interface AuditLogger {
  log(entry: AuditEntry, manager?: EntityManager): Promise<void>;
}
