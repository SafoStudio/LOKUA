import type { Repository } from 'typeorm';
import type { AuditLogger, AuditEntry } from '../../../application/index.js';
import { AuditLogEntity } from '../entities/audit-log.entity.js';
import type { TransactionContext } from '../../../../../common/index.js';
import { toEntityManager } from '../../../../../common/index.js';

export class AuditLoggerAdapter implements AuditLogger {
  constructor(private readonly repo: Repository<AuditLogEntity>) {}

  async log(entry: AuditEntry, tx?: TransactionContext): Promise<void> {
    const repo = tx ? toEntityManager(tx).getRepository(AuditLogEntity) : this.repo;

    const entity = repo.create({
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      beforeState: entry.beforeState ?? null,
      afterState: entry.afterState ?? null,
      reason: entry.reason ?? null,
      ip: entry.ip ?? null
    });

    await repo.save(entity);
  }
}
