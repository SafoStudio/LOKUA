import type { TransactionContext, AgeRestriction } from '../../../../common/index.js';
import type {
  AccountStatus,
  ContentType,
  ReportObjectType,
  ReportStatus
} from '../../domain/index.js';
import type { ModerationReport } from '../../domain/models/moderation-report.js';

export interface ModerationTarget {
  id: string;
  ownerId: string;
  eventId: string | null;
  organizerId: string | null;
  eventStatus: string | null;
  ageRestriction: AgeRestriction | null;
  eventHidden: boolean;
  visible: boolean;
  content: Record<string, unknown>;
}

export interface ModerationStorePort {
  target(
    type: ReportObjectType,
    id: string,
    tx?: TransactionContext
  ): Promise<ModerationTarget | undefined>;
  visibility(
    type: ContentType,
    id: string,
    eventId: string,
    hidden: boolean,
    tx: TransactionContext
  ): Promise<boolean | undefined>;
  lockReporter(id: string, tx: TransactionContext): Promise<void>;
  countRecent(reporterId: string, since: Date, tx: TransactionContext): Promise<number>;
  hasOpenReport(
    reporterId: string,
    type: ReportObjectType,
    id: string,
    tx: TransactionContext
  ): Promise<boolean>;
  create(
    data: Pick<ModerationReport, 'reporterId' | 'objectType' | 'objectId' | 'reason' | 'text'>,
    tx: TransactionContext
  ): Promise<ModerationReport>;
  find(id: string, tx?: TransactionContext): Promise<ModerationReport | null>;
  save(report: ModerationReport, tx: TransactionContext): Promise<ModerationReport>;
  list(limit: number, status?: ReportStatus, cursor?: string): Promise<ModerationReport[]>;
  account(
    id: string,
    tx: TransactionContext
  ): Promise<{ id: string; status: string; blockedUntil: Date | null } | undefined>;
  setAccount(
    id: string,
    status: AccountStatus,
    blockedUntil: Date | null,
    tx: TransactionContext
  ): Promise<void>;
  expiredAccounts(now: Date, limit: number, tx: TransactionContext): Promise<{ id: string }[]>;
  participates(eventId: string, userId: string, tx: TransactionContext): Promise<boolean>;
}
