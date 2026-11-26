import { AppError } from '../../../../common/index.js';
import type { UnitOfWork } from '../../../../common/index.js';
import type { NotificationPublisher } from '../../../notifications/index.js';
import type { AccessService, AuthUser, UserBlockProvider } from '../../../users/index.js';
import type { ReportObjectType, ReportStatus } from '../../domain/index.js';
import type {
  ModerationStore,
  AccountStatus
} from '../../infrastructure/persistence/adapters/moderation.store.js';
import type { ContentType } from '../../infrastructure/persistence/adapters/moderation-targets.js';
import type { AuditLogger } from '../ports/audit-logger.js';

export class ModerationUseCase {
  constructor(
    private readonly store: ModerationStore,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditLogger,
    private readonly access: AccessService,
    private readonly blocks: UserBlockProvider,
    private readonly notifications: NotificationPublisher,
    private readonly clock: () => Date
  ) {}

  submit(
    user: AuthUser,
    data: { objectType: ReportObjectType; objectId: string; reason: string; text?: string }
  ) {
    if (user.role !== 'USER' || this.access.isBlocked(user))
      throw new AppError('Reporting is not allowed', 403);
    return this.unitOfWork.run(async (tx) => {
      await this.store.lockReporter(user.id, tx);
      const now = this.clock();
      const target = await this.store.target(data.objectType, data.objectId, tx);
      const blockedIds = await this.blocks.listRelatedUserIds(user.id, tx);
      if (!target?.visible || blockedIds.includes(target.ownerId)) {
        throw new AppError('Report target not found', 404);
      }
      if (target.eventId && target.organizerId !== user.id) {
        if (
          target.eventHidden ||
          target.eventStatus === 'DRAFT' ||
          (target.organizerId && blockedIds.includes(target.organizerId)) ||
          !target.ageRestriction ||
          !this.access.canViewEvent(user, target.ageRestriction, now) ||
          (target.eventStatus === 'CANCELLED' &&
            !(await this.store.participates(target.eventId, user.id, tx)))
        ) {
          throw new AppError('Report target not found', 404);
        }
      }
      if (target.eventStatus === 'DRAFT') throw new AppError('Report target not found', 404);
      if (await this.store.hasOpenReport(user.id, data.objectType, data.objectId, tx)) {
        throw new AppError('An active report already exists', 409);
      }
      if ((await this.store.countRecent(user.id, new Date(now.getTime() - 3_600_000), tx)) >= 10) {
        throw new AppError('Report submission limit exceeded', 429);
      }
      return this.store.create({ ...data, reporterId: user.id, text: data.text ?? '' }, tx);
    });
  }

  async list(limit: number, status?: ReportStatus, cursor?: string) {
    const rows = await this.store.list(limit + 1, status, cursor);
    const items = rows.slice(0, limit);
    return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
  }

  inspect(admin: AuthUser, id: string, ip: string | null) {
    return this.unitOfWork.run(async (tx) => {
      const report = await this.store.find(id, tx);
      if (!report) throw new AppError('Report not found', 404);
      const target = await this.store.target(report.objectType, report.objectId, tx);
      await this.audit.log(
        {
          actorId: admin.id,
          action: 'REPORT_TARGET_VIEWED',
          targetType: 'REPORT',
          targetId: id,
          ip
        },
        tx
      );
      return {
        report,
        target: target
          ? {
              id: target.id,
              ownerId: target.ownerId,
              eventId: target.eventId,
              content: target.content
            }
          : null
      };
    });
  }

  transition(
    admin: AuthUser,
    id: string,
    status: Exclude<ReportStatus, 'NEW'>,
    notes: string | null,
    ip: string | null
  ) {
    return this.unitOfWork.run(async (tx) => {
      const report = await this.store.find(id, tx);
      if (!report) throw new AppError('Report not found', 404);
      const expected = status === 'IN_PROGRESS' ? 'NEW' : 'IN_PROGRESS';
      if (report.status !== expected)
        throw new AppError('Report status transition is not allowed', 409);
      const saved = await this.store.save(
        {
          ...report,
          status,
          assignedModeratorId: report.assignedModeratorId ?? admin.id,
          resolutionNotes: notes
        },
        tx
      );
      await this.audit.log(
        {
          actorId: admin.id,
          action: status === 'IN_PROGRESS' ? 'REPORT_STARTED' : 'REPORT_RESOLVED',
          targetType: 'REPORT',
          targetId: id,
          beforeState: { status: report.status },
          afterState: { status },
          reason: notes,
          ip
        },
        tx
      );
      return saved;
    });
  }

  visibility(
    admin: AuthUser,
    type: ContentType,
    id: string,
    hidden: boolean,
    reason: string,
    ip: string | null
  ) {
    return this.unitOfWork.run(async (tx) => {
      const target = await this.store.target(type, id, tx);
      if (!target?.eventId) throw new AppError('Content not found', 404);
      const previous = await this.store.visibility(type, id, target.eventId, hidden, tx);
      if (previous === undefined) throw new AppError('Content not found', 404);
      if (previous !== hidden) {
        await this.audit.log(
          {
            actorId: admin.id,
            action: hidden ? 'CONTENT_HIDDEN' : 'CONTENT_RESTORED',
            targetType: type,
            targetId: id,
            beforeState: { isHiddenByAdmin: previous },
            afterState: { isHiddenByAdmin: hidden },
            reason,
            ip
          },
          tx
        );
      }
      return { id, isHiddenByAdmin: hidden };
    });
  }

  account(
    admin: AuthUser,
    id: string,
    status: AccountStatus,
    blockedUntil: Date | null,
    reason: string,
    ip: string | null
  ) {
    if (id === admin.id)
      throw new AppError('Administrators cannot change their own account status', 403);
    return this.unitOfWork.run(async (tx) => {
      const previous = await this.store.account(id, tx);
      if (!previous) throw new AppError('User not found', 404);
      if (status === 'BLOCKED_TEMPORARY' && (!blockedUntil || blockedUntil <= this.clock())) {
        throw new AppError('The temporary block must end in the future', 422);
      }
      if (
        previous.status === status &&
        previous.blockedUntil?.getTime() === blockedUntil?.getTime()
      ) {
        return { id, status, blockedUntil };
      }
      const blocked =
        previous.status === 'BLOCKED_TEMPORARY' || previous.status === 'BLOCKED_PERMANENT';
      if (status === 'ACTIVE' ? !blocked : previous.status !== 'ACTIVE') {
        throw new AppError('Account status transition is not allowed', 409);
      }
      await this.store.setAccount(id, status, blockedUntil, tx);
      await this.audit.log(
        {
          actorId: admin.id,
          action: status === 'ACTIVE' ? 'USER_UNBLOCKED' : 'USER_BLOCKED',
          targetType: 'USER',
          targetId: id,
          beforeState: { status: previous.status, blockedUntil: previous.blockedUntil },
          afterState: { status, blockedUntil },
          reason,
          ip
        },
        tx
      );
      await this.notifications.publish(tx, {
        type: 'ACCOUNT_STATUS_CHANGED',
        targetType: 'USER',
        targetId: id,
        recipientId: id
      });
      return { id, status, blockedUntil };
    });
  }

  expireBlocks(): Promise<boolean> {
    const limit = 100;
    return this.unitOfWork.run(async (tx) => {
      const users = await this.store.expiredAccounts(this.clock(), limit, tx);
      for (const { id } of users) await this.store.setAccount(id, 'ACTIVE', null, tx);
      await this.notifications.publish(
        tx,
        ...users.map(({ id }) => ({
          type: 'ACCOUNT_STATUS_CHANGED' as const,
          targetType: 'USER' as const,
          targetId: id,
          recipientId: id
        }))
      );
      return users.length === limit;
    });
  }
}
