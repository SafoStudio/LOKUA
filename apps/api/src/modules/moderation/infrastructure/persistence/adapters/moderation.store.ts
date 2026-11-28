import type { DataSource } from 'typeorm';
import { toEntityManager } from '../../../../../common/index.js';
import type { TransactionContext } from '../../../../../common/index.js';
import type {
  AccountStatus,
  ContentType,
  ReportObjectType,
  ReportStatus
} from '../../../domain/index.js';
import type { ModerationStorePort } from '../../../application/index.js';
import { ReportEntity } from '../entities/report.entity.js';
import { readModerationTarget, setModerationVisibility } from './moderation-targets.js';

interface AccountState {
  id: string;
  status: string;
  blockedUntil: Date | null;
}

export class ModerationStore implements ModerationStorePort {
  constructor(private readonly dataSource: DataSource) {}

  target(type: ReportObjectType, id: string, tx?: TransactionContext) {
    return readModerationTarget(tx ? toEntityManager(tx) : this.dataSource.manager, type, id);
  }

  visibility(
    type: ContentType,
    id: string,
    eventId: string,
    hidden: boolean,
    tx: TransactionContext
  ) {
    return setModerationVisibility(toEntityManager(tx), type, id, eventId, hidden);
  }

  async lockReporter(id: string, tx: TransactionContext): Promise<void> {
    await toEntityManager(tx).query(
      "SELECT pg_advisory_xact_lock(hashtext('report-submission'), hashtext($1))",
      [id]
    );
  }

  countRecent(reporterId: string, since: Date, tx: TransactionContext) {
    return this.reports(tx)
      .createQueryBuilder('report')
      .where('report.reporter_id = :reporterId AND report.created_at > :since', {
        reporterId,
        since
      })
      .getCount();
  }

  hasOpenReport(
    reporterId: string,
    objectType: ReportObjectType,
    objectId: string,
    tx: TransactionContext
  ) {
    return this.reports(tx)
      .createQueryBuilder('report')
      .where(
        'report.reporter_id = :reporterId AND report.object_type = :objectType AND report.object_id = :objectId',
        {
          reporterId,
          objectType,
          objectId
        }
      )
      .andWhere("report.status IN ('NEW', 'IN_PROGRESS')")
      .getExists();
  }

  create(
    data: Pick<ReportEntity, 'reporterId' | 'objectType' | 'objectId' | 'reason' | 'text'>,
    tx: TransactionContext
  ) {
    const reports = this.reports(tx);
    return reports.save(
      reports.create({
        ...data,
        status: 'NEW',
        assignedModeratorId: null,
        resolutionNotes: null
      })
    );
  }

  find(id: string, tx?: TransactionContext) {
    return this.reports(tx).findOne({
      where: { id },
      ...(tx ? { lock: { mode: 'pessimistic_write' as const } } : {})
    });
  }

  save(report: ReportEntity, tx: TransactionContext) {
    return this.reports(tx).save(report);
  }

  list(limit: number, status?: ReportStatus, cursor?: string) {
    const query = this.reports()
      .createQueryBuilder('report')
      .orderBy('report.createdAt', 'ASC')
      .addOrderBy('report.id', 'ASC')
      .limit(limit);
    if (status) query.andWhere('report.status = :status', { status });
    if (cursor) {
      query.andWhere(
        `(report.created_at, report.id) > (
        SELECT anchor.created_at, anchor.id FROM reports anchor WHERE anchor.id = :cursor
      )`,
        { cursor }
      );
    }
    return query.getMany();
  }

  async account(id: string, tx: TransactionContext): Promise<AccountState | undefined> {
    const [state] = await toEntityManager(tx).query<AccountState[]>(
      'SELECT id, status, blocked_until AS "blockedUntil" FROM users WHERE id = $1 FOR UPDATE',
      [id]
    );
    return state;
  }

  async setAccount(
    id: string,
    status: AccountStatus,
    blockedUntil: Date | null,
    tx: TransactionContext
  ) {
    await toEntityManager(tx).query(
      `UPDATE users SET status = $2, blocked_until = $3,
       session_version = uuid_generate_v4(), updated_at = now() WHERE id = $1`,
      [id, status, blockedUntil]
    );
  }

  expiredAccounts(now: Date, limit: number, tx: TransactionContext) {
    return toEntityManager(tx).query<{ id: string }[]>(
      `SELECT id FROM users WHERE status = 'BLOCKED_TEMPORARY' AND blocked_until <= $1
       ORDER BY blocked_until, id LIMIT $2 FOR UPDATE SKIP LOCKED`,
      [now, limit]
    );
  }

  async participates(eventId: string, userId: string, tx: TransactionContext): Promise<boolean> {
    const [result] = await toEntityManager(tx).query<{ visible: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM event_participations WHERE event_id = $1 AND user_id = $2
        AND status IN ('APPROVED', 'PENDING')) AS visible`,
      [eventId, userId]
    );
    return result?.visible ?? false;
  }

  private reports(tx?: TransactionContext) {
    return (tx ? toEntityManager(tx) : this.dataSource.manager).getRepository(ReportEntity);
  }
}
