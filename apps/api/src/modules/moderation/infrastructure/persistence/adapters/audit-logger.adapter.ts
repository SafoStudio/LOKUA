import type { EntityManager, Repository } from 'typeorm';
import type { AuditLogger, AuditEntry } from '../../../application/index.js';
import { AuditLogEntity } from '../entities/audit-log.entity.js';

export class AuditLoggerAdapter implements AuditLogger {
  constructor(private readonly repo: Repository<AuditLogEntity>) {}

  async log(entry: AuditEntry, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(AuditLogEntity) : this.repo;
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
