import type { DataSource } from 'typeorm';
import type { AuditLogger } from './application/index.js';
import { AuditLogEntity, AuditLoggerAdapter } from './infrastructure/index.js';

interface CreateModerationModuleDependencies {
  dataSource: DataSource;
}

export function createModerationModule({ dataSource }: CreateModerationModuleDependencies) {
  const audit: AuditLogger = new AuditLoggerAdapter(dataSource.getRepository(AuditLogEntity));

  return {
    audit
  };
}

export type ModerationModule = ReturnType<typeof createModerationModule>;
