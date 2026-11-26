import type { TransactionContext } from '../../common/index.js';
import type { NotificationType } from './domain/index.js';

export interface NotificationInput {
  type: NotificationType;
  targetType: 'EVENT' | 'COMMENT' | 'REVIEW' | 'USER';
  targetId: string;
  recipientId: string;
  eventTitle?: string;
  reason?: string | null;
  deduplicationKey?: string;
}

export interface NotificationPublisher {
  publish(tx: TransactionContext, ...notifications: NotificationInput[]): Promise<void>;
}
