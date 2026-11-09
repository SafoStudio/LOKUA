import type { Repository } from 'typeorm';
import type { SecurityEventRepository } from '../../../application/index.js';
import type { SecurityEventType } from '../../../domain/index.js';
import type { SecurityEventEntity } from '../entities/security-event.entity.js';
import { logger } from '../../../../../common/index.js';

export class SecurityEventRepositoryAdapter implements SecurityEventRepository {
  constructor(private readonly repository: Repository<SecurityEventEntity>) {}

  async record(data: {
    userId: string | null;
    eventType: SecurityEventType;
    ip: string | null;
    userAgent: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      const entity = this.repository.create({
        userId: data.userId,
        eventType: data.eventType,
        ip: data.ip,
        userAgent: data.userAgent,
        metadata: data.metadata ?? null
      });

      await this.repository.save(entity);
    } catch (err) {
      logger.error(
        { err, eventType: data.eventType, userId: data.userId },
        'Failed to record security event'
      );
    }
  }
}
