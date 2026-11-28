import type { DataSource, Repository } from 'typeorm';
import { logger, toEntityManager } from '../../../common/index.js';
import type { TransactionContext } from '../../../common/index.js';
import { notificationCopy } from '../notification-copy.js';
import type { NotificationInput, NotificationPublisher } from '../notification-publisher.js';
import type { NotificationReader } from '../application/index.js';
import { NotificationEntity } from './persistence/entities/notification.entity.js';

export type NotificationEmailSender = (email: {
  to: string;
  title: string;
  message: string;
}) => Promise<void>;

interface DeliveryRow {
  id: string;
  type: keyof typeof notificationCopy;
  title: string;
  message: string;
  email: string;
  allowed: boolean;
  attempts: number;
  recipientId: string;
  deletionRequestedAt: Date | null;
}

export type AccountRecoveryLink = (userId: string, requestedAt: Date) => Promise<string>;

export class NotificationStore implements NotificationPublisher, NotificationReader {
  private readonly repository: Repository<NotificationEntity>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly sendEmail: NotificationEmailSender,
    private readonly accountRecoveryLink?: AccountRecoveryLink
  ) {
    this.repository = dataSource.getRepository(NotificationEntity);
  }

  async publish(tx: TransactionContext, ...notifications: NotificationInput[]) {
    if (notifications.length === 0) return;
    const now = new Date();
    const values = notifications.map((notification) => {
      const copy = notificationCopy[notification.type];
      const message = [
        copy.message,
        notification.eventTitle ? `Подія: ${notification.eventTitle}` : null,
        notification.reason ? `Причина: ${notification.reason}` : null
      ]
        .filter(Boolean)
        .join('\n');
      return {
        type: notification.type,
        targetType: notification.targetType,
        targetId: notification.targetId,
        recipientId: notification.recipientId,
        deduplicationKey: notification.deduplicationKey ?? null,
        title: copy.title,
        message,
        emailDueAt: copy.email ? now : null
      };
    });
    const manager = toEntityManager(tx);
    for (let offset = 0; offset < values.length; offset += 500) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(NotificationEntity)
        .values(values.slice(offset, offset + 500))
        .orIgnore()
        .execute();
    }
  }

  list(userId: string, limit: number, cursor?: string): Promise<NotificationEntity[]> {
    const builder = this.repository
      .createQueryBuilder('notification')
      .where('notification.recipient_id = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .addOrderBy('notification.id', 'DESC')
      .limit(limit);
    if (cursor) {
      builder.andWhere(
        `(notification.created_at, notification.id) < (
           SELECT anchor.created_at, anchor.id FROM notifications anchor
           WHERE anchor.id = :cursor AND anchor.recipient_id = :userId
         )`,
        { cursor }
      );
    }
    return builder.getMany();
  }

  async getPreferences(userId: string): Promise<{ emailEnabled: boolean } | undefined> {
    const [preferences] = await this.dataSource.query<{ emailEnabled: boolean }[]>(
      'SELECT email_notifications_enabled AS "emailEnabled" FROM users WHERE id = $1',
      [userId]
    );
    return preferences;
  }

  async setPreferences(userId: string, emailEnabled: boolean): Promise<void> {
    await this.dataSource.query('UPDATE users SET email_notifications_enabled = $2 WHERE id = $1', [
      userId,
      emailEnabled
    ]);
  }

  async markRead(userId: string, id: string): Promise<boolean> {
    const result = await this.repository.update({ id, recipientId: userId }, { isRead: true });
    return Boolean(result.affected);
  }

  processDelivery(): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query<DeliveryRow[]>(
        `SELECT notification.id, notification.type, notification.title, notification.message,
                recipient.id AS "recipientId", recipient.email,
                CASE WHEN recipient.status = 'PENDING_DELETION'
                  AND notification.deduplication_key = concat(
                    'account-deletion:', recipient.id, ':',
                    (extract(epoch FROM recipient.deletion_requested_at) * 1000)::bigint
                  ) THEN recipient.deletion_requested_at
                END AS "deletionRequestedAt",
                recipient.email_notifications_enabled AND recipient.email_verified
                   AND recipient.status = 'ACTIVE'
                   AND (
                     notification.type <> 'EVENT_REMINDER_24H' OR EXISTS (
                       SELECT 1 FROM events event
                       JOIN event_participations participation ON participation.event_id = event.id
                       WHERE event.id = notification.target_id
                         AND event.status IN ('PUBLISHED', 'FULL')
                         AND NOT event.is_hidden_by_admin
                         AND event.first_starts_at > now()
                         AND participation.user_id = recipient.id AND participation.status = 'APPROVED'
                         AND notification.deduplication_key = concat(
                           'start:', event.id, ':', recipient.id, ':', extract(epoch FROM event.first_starts_at)
                         )
                     )
                   )
                   AND (
                     notification.type <> 'REVIEW_REMINDER' OR EXISTS (
                       SELECT 1 FROM events event
                       JOIN event_participations participation ON participation.event_id = event.id
                       WHERE event.id = notification.target_id AND event.status = 'COMPLETED'
                         AND NOT event.is_hidden_by_admin
                         AND event.first_ends_at > now() - interval '7 days'
                         AND participation.user_id = recipient.id AND participation.status = 'APPROVED'
                     )
                   ) AS allowed, notification.email_attempts AS attempts
         FROM notifications notification
         JOIN users recipient ON recipient.id = notification.recipient_id
         WHERE notification.email_due_at <= now()
         ORDER BY notification.email_due_at, notification.id
         LIMIT 1 FOR UPDATE OF notification SKIP LOCKED`
      );
      if (!row) return false;
      let nextAttempt: Date | null = null;
      const sendRecovery = row.type === 'ACCOUNT_DELETION_REQUESTED' && row.deletionRequestedAt;
      if (
        sendRecovery ||
        row.type === 'ACCOUNT_STATUS_CHANGED' ||
        (row.type !== 'ACCOUNT_DELETION_REQUESTED' && row.allowed)
      ) {
        try {
          let message = row.message;
          if (sendRecovery) {
            if (!this.accountRecoveryLink) throw new Error('Account recovery link unavailable');
            const link = await this.accountRecoveryLink(row.recipientId, sendRecovery);
            message = `${message}\nВідновити акаунт: ${link}`;
          }
          await this.sendEmail({ to: row.email, title: row.title, message });
        } catch {
          const delay = Math.min(60 * 2 ** row.attempts, 3600);
          nextAttempt = new Date(Date.now() + delay * 1000);
          logger.warn({ notificationId: row.id }, 'Notification email delivery failed');
        }
      }
      await manager.getRepository(NotificationEntity).update(row.id, {
        emailDueAt: nextAttempt,
        emailAttempts: row.attempts + 1
      });
      return true;
    });
  }
}
