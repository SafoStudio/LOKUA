import { AppError, logger } from '../../../../common/index.js';
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
  finalizeNext(cutoff: Date, now: Date, tx: TransactionContext): Promise<boolean>;
  claimMediaCleanup(now: Date, retryAt: Date, tx: TransactionContext): Promise<string | null>;
  completeMediaCleanup(userId: string, tx: TransactionContext): Promise<void>;
}

export interface AccountDeletionEvents {
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
    private readonly deleteImages: (userId: string) => Promise<void>,
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

  async finalizeNext(): Promise<boolean> {
    const now = this.clock();
    const cutoff = new Date(now.getTime() - accountRecoveryPeriodMs);
    const finalized = await this.unitOfWork.run((tx) => this.store.finalizeNext(cutoff, now, tx));
    const retryAt = new Date(now.getTime() + 5 * 60_000);
    const userId = await this.unitOfWork.run((tx) =>
      this.store.claimMediaCleanup(now, retryAt, tx)
    );
    if (!userId) return finalized;

    try {
      await this.deleteImages(userId);
      await this.unitOfWork.run((tx) => this.store.completeMediaCleanup(userId, tx));
    } catch (err) {
      logger.error({ err, userId }, 'Account media cleanup failed');
    }
    return true;
  }
}
