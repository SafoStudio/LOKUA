import { toEntityManager } from '../../../../../common/index.js';
import type { TransactionContext } from '../../../../../common/index.js';
import type { AccountDeletionStore } from '../../../application/services/account-deletion.service.js';
import { UserEntity } from '../entities/user.entity.js';

const deletedName = 'Видалений користувач';

export class TypeOrmAccountDeletionStore implements AccountDeletionStore {
  constructor(private readonly deleteImages: (ownerId: string) => Promise<void>) {}

  async request(userId: string, now: Date, tx: TransactionContext): Promise<boolean> {
    const manager = toEntityManager(tx);
    const result = await manager
      .getRepository(UserEntity)
      .update(
        { id: userId, status: 'ACTIVE' },
        { status: 'PENDING_DELETION', deletionRequestedAt: now }
      );
    if (!result.affected) return false;

    await manager.query(
      'UPDATE refresh_sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL',
      [userId, now]
    );
    return true;
  }

  async restore(userId: string, requestedAt: Date, cutoff: Date, tx: TransactionContext) {
    const result = await toEntityManager(tx)
      .getRepository(UserEntity)
      .createQueryBuilder()
      .update()
      .set({ status: 'ACTIVE' })
      .where('id = :userId AND status = :status', { userId, status: 'PENDING_DELETION' })
      .andWhere('deletion_requested_at = :requestedAt AND deletion_requested_at > :cutoff', {
        requestedAt,
        cutoff
      })
      .execute();
    return Boolean(result.affected);
  }

  async finalizeNext(cutoff: Date, tx: TransactionContext): Promise<boolean> {
    const manager = toEntityManager(tx);
    const users = manager.getRepository(UserEntity);
    const user = await users
      .createQueryBuilder('account')
      .where("account.status = 'PENDING_DELETION' AND account.deletion_requested_at <= :cutoff", {
        cutoff
      })
      .orderBy('account.deletionRequestedAt', 'ASC')
      .addOrderBy('account.id', 'ASC')
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .take(1)
      .getOne();
    if (!user) return false;

    const { id, email } = user;
    await this.deleteImages(id);

    const userDataTables = [
      'password_credentials',
      'google_credentials',
      'passkey_credentials',
      'refresh_sessions',
      'email_verification_tokens',
      'password_reset_tokens',
      'onboarding_states',
      'user_interests',
      'user_photos',
      'security_events'
    ];
    for (const table of userDataTables) {
      await manager.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]);
    }
    await manager.query('DELETE FROM passkey_challenges WHERE user_id = $1 OR email = $2', [
      id,
      email
    ]);
    await manager.query('DELETE FROM discussion_comment_quotas WHERE author_id = $1', [id]);
    await manager.query('DELETE FROM user_blocks WHERE blocker_id = $1 OR blocked_id = $1', [id]);
    await manager.query('DELETE FROM notifications WHERE recipient_id = $1', [id]);
    await manager.query('UPDATE locations SET created_by = NULL WHERE created_by = $1', [id]);
    await manager.query("DELETE FROM events WHERE organizer_id = $1 AND status = 'DRAFT'", [id]);
    await manager.query(
      "UPDATE events SET cover_url = NULL, media_urls = '[]' WHERE organizer_id = $1",
      [id]
    );
    await manager.query(
      'UPDATE event_participations SET application_message = NULL, removal_reason = NULL WHERE user_id = $1',
      [id]
    );
    await manager.query('UPDATE reports SET text = $2 WHERE reporter_id = $1', [id, deletedName]);
    await manager.query(
      `UPDATE audit_logs SET before_state = NULL, after_state = NULL, ip = NULL, reason = NULL
       WHERE actor_id = $1 OR (target_type = 'USER' AND target_id = $1)`,
      [id]
    );

    await users.update(id, {
      status: 'DELETED',
      email: `deleted:${id}`,
      name: deletedName,
      birthDate: null,
      cityId: null,
      bio: null,
      languages: null,
      socialLinks: null,
      emailVerified: false,
      emailNotificationsEnabled: false,
      onboardingCompleted: false,
      termsAcceptedAt: null,
      notificationSettings: null,
      blockedUntil: null,
      deletionRequestedAt: null,
      role: 'USER'
    });
    return true;
  }
}
