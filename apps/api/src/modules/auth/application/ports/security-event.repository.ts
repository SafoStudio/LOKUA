import type { SecurityEventType } from '../../domain/index.js';

export interface SecurityEventRepository {
  record(data: {
    userId: string | null;
    eventType: SecurityEventType;
    ip: string | null;
    userAgent: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void>;
}
