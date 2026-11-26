import type { TransactionContext } from '../../../common/index.js';
import type { NotificationInput, NotificationPublisher } from '../../notifications/index.js';
import type { Event } from '../domain/index.js';

export async function publishEventNotification(
  publisher: NotificationPublisher | undefined,
  tx: TransactionContext,
  event: Event,
  type: NotificationInput['type'],
  recipientIds: string[],
  reason?: string | null
): Promise<void> {
  await publisher?.publish(
    tx,
    ...recipientIds.map((recipientId) => ({
      type,
      targetType: 'EVENT' as const,
      targetId: event.id,
      recipientId,
      eventTitle: event.title,
      reason
    }))
  );
}
