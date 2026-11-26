import { toEntityManager } from '../../../../../common/index.js';
import type { TransactionContext } from '../../../../../common/index.js';
import type { EventLifecycleRepository } from '../../../application/ports/event-lifecycle.repository.js';
import type { NotificationPublisher } from '../../../../notifications/index.js';

interface LifecycleRecipient {
  event_id: string;
  user_id: string;
  title: string;
}

interface ReminderRecipient extends LifecycleRecipient {
  deduplication_key: string;
}

export class EventLifecycleRepositoryAdapter implements EventLifecycleRepository {
  constructor(private readonly notifications?: NotificationPublisher) {}

  async advanceDueEvents(now: Date, limit: number, tx: TransactionContext): Promise<number> {
    const manager = toEntityManager(tx);
    const dueEvents = await manager.query<{ id: string }[]>(
      `SELECT event.id
       FROM events event
       WHERE event.status IN ('PUBLISHED', 'FULL')
         AND event.first_starts_at <= $1
         AND (
           event.first_ends_at <= $1 OR EXISTS (
             SELECT 1 FROM event_participations participation
             WHERE participation.event_id = event.id AND participation.status = 'PENDING'
           )
         )
       ORDER BY event.first_starts_at, event.id
       LIMIT $2
       FOR UPDATE OF event SKIP LOCKED`,
      [now, limit]
    );
    if (dueEvents.length === 0) return this.scheduleReminders(now, limit, tx);

    const eventIds = dueEvents.map(({ id }) => id);
    // Read participations after acquiring the same event lock used by HTTP mutations.
    await manager.query(
      `UPDATE event_participations
       SET status = 'NOT_CONSIDERED', status_updated_at = $2, updated_at = $2
       WHERE event_id = ANY($1::uuid[]) AND status = 'PENDING'`,
      [eventIds, now]
    );

    const completed = await manager.query<LifecycleRecipient[]>(
      `WITH completed AS (
         UPDATE events
         SET status = 'COMPLETED', updated_at = $2
         WHERE id = ANY($1::uuid[]) AND first_ends_at <= $2
         RETURNING id, organizer_id, title, primary_location_id, first_starts_at, first_ends_at, timezone
       ), archived AS (
         UPDATE discussion_comments comment
         SET is_archived = true, updated_at = $2
         FROM completed
         WHERE comment.event_id = completed.id AND NOT comment.is_archived
       ), occurrences AS (
       INSERT INTO event_occurrences (
         event_id, location_id, starts_at, ends_at, timezone, status, created_at, updated_at
       )
       SELECT id, primary_location_id, first_starts_at, first_ends_at, timezone, 'COMPLETED', $2, $2
       FROM completed
       ON CONFLICT (event_id, starts_at) DO UPDATE
       SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
       WHERE event_occurrences.status IN ('SCHEDULED', 'FULL')
       )
       SELECT completed.id AS event_id, completed.title, participation.user_id
       FROM completed
       JOIN event_participations participation ON participation.event_id = completed.id
       WHERE participation.status = 'APPROVED' AND participation.user_id <> completed.organizer_id
         AND completed.first_ends_at > $2 - INTERVAL '7 days'`,
      [eventIds, now]
    );
    await this.notifications?.publish(
      tx,
      ...completed.map((recipient) => ({
        type: 'REVIEW_REMINDER' as const,
        targetType: 'EVENT' as const,
        targetId: recipient.event_id,
        recipientId: recipient.user_id,
        eventTitle: recipient.title
      }))
    );
    return Math.max(eventIds.length, await this.scheduleReminders(now, limit, tx));
  }

  private async scheduleReminders(
    now: Date,
    limit: number,
    tx: TransactionContext
  ): Promise<number> {
    if (!this.notifications) return 0;
    const manager = toEntityManager(tx);
    const key =
      "concat('start:', event.id, ':', participation.user_id, ':', extract(epoch FROM event.first_starts_at))";
    const due = await manager.query<ReminderRecipient[]>(
      `SELECT event.id AS event_id, event.title, participation.user_id, ${key} AS deduplication_key
       FROM events event
       JOIN event_participations participation ON participation.event_id = event.id
       WHERE event.status IN ('PUBLISHED', 'FULL')
         AND event.first_starts_at > $1 AND event.first_starts_at <= $2
         AND participation.status = 'APPROVED' AND participation.user_id <> event.organizer_id
         AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.deduplication_key = ${key})
       ORDER BY event.first_starts_at, event.id, participation.user_id
       LIMIT $3 FOR UPDATE OF event SKIP LOCKED`,
      [now, new Date(now.getTime() + 24 * 60 * 60 * 1000), limit]
    );
    await this.notifications.publish(
      tx,
      ...due.map((recipient) => ({
        type: 'EVENT_REMINDER_24H' as const,
        targetType: 'EVENT' as const,
        targetId: recipient.event_id,
        recipientId: recipient.user_id,
        eventTitle: recipient.title,
        deduplicationKey: recipient.deduplication_key
      }))
    );
    return due.length;
  }
}
