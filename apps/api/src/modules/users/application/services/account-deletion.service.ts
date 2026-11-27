import { AppError } from '../../../../common/index.js';
import type { TransactionContext, UnitOfWork } from '../../../../common/index.js';
import type { NotificationPublisher } from '../../../notifications/index.js';

export const accountRecoveryPeriodMs = 30 * 24 * 60 * 60 * 1000;

export interface AccountDeletionStore {
  request(userId: string, now: Date, tx: TransactionContext): Promise<boolean>;
  restore(
    userId: string,
    requestedAt: Date,
    cutoff: Date,
    tx: TransactionContext
  ): Promise<boolean>;
  finalizeNext(cutoff: Date, tx: TransactionContext): Promise<boolean>;
}

interface AccountDeletionEvents {
  lockOrganizerForAccountChange(userId: string, tx: TransactionContext): Promise<void>;
  cancelUpcomingForAccountDeletion(
    userId: string,
    now: Date,
    tx: TransactionContext
  ): Promise<void>;
}

export class AccountDeletionService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly store: AccountDeletionStore,
    private readonly events: AccountDeletionEvents,
    private readonly notifications: NotificationPublisher,
    private readonly clock: () => Date = () => new Date()
  ) {}

  request(userId: string): Promise<Date> {
    return this.unitOfWork.run(async (tx) => {
      await this.events.lockOrganizerForAccountChange(userId, tx);
      const now = this.clock();
      if (!(await this.store.request(userId, now, tx))) {
        throw new AppError('Акаунт недоступний для видалення', 409);
      }

      await this.events.cancelUpcomingForAccountDeletion(userId, now, tx);
      await this.notifications.publish(tx, {
        type: 'ACCOUNT_DELETION_REQUESTED',
        targetType: 'USER',
        targetId: userId,
        recipientId: userId,
        deduplicationKey: `account-deletion:${userId}:${now.getTime()}`
      });
      return new Date(now.getTime() + accountRecoveryPeriodMs);
    });
  }

  async restore(userId: string, requestedAt: Date): Promise<void> {
    await this.unitOfWork.run(async (tx) => {
      const cutoff = new Date(this.clock().getTime() - accountRecoveryPeriodMs);
      if (!(await this.store.restore(userId, requestedAt, cutoff, tx))) {
        throw new AppError('Посилання для відновлення недійсне або прострочене', 400);
      }
    });
  }

  finalizeNext(): Promise<boolean> {
    const cutoff = new Date(this.clock().getTime() - accountRecoveryPeriodMs);
    return this.unitOfWork.run((tx) => this.store.finalizeNext(cutoff, tx));
  }
}
