import { toEntityManager } from '../../../../../common/index.js';
import type { TransactionContext } from '../../../../../common/index.js';
import type { EventLifecycleRepository } from '../../../application/ports/event-lifecycle.repository.js';

export class EventLifecycleRepositoryAdapter implements EventLifecycleRepository {
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
    if (dueEvents.length === 0) return 0;

    const eventIds = dueEvents.map(({ id }) => id);
    // Read participations after acquiring the same event lock used by HTTP mutations.
    await manager.query(
      `UPDATE event_participations
       SET status = 'NOT_CONSIDERED', status_updated_at = $2, updated_at = $2
       WHERE event_id = ANY($1::uuid[]) AND status = 'PENDING'`,
      [eventIds, now]
    );

    await manager.query(
      `WITH completed AS (
         UPDATE events
         SET status = 'COMPLETED', updated_at = $2
         WHERE id = ANY($1::uuid[]) AND first_ends_at <= $2
         RETURNING id, primary_location_id, first_starts_at, first_ends_at, timezone
       )
       INSERT INTO event_occurrences (
         event_id, location_id, starts_at, ends_at, timezone, status, created_at, updated_at
       )
       SELECT id, primary_location_id, first_starts_at, first_ends_at, timezone, 'COMPLETED', $2, $2
       FROM completed
       ON CONFLICT (event_id, starts_at) DO UPDATE
       SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
       WHERE event_occurrences.status IN ('SCHEDULED', 'FULL')`,
      [eventIds, now]
    );
    return eventIds.length;
  }
}
