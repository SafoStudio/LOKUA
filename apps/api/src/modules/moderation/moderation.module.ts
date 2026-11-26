import type { DataSource } from 'typeorm';
import type { RequestHandler } from 'express';
import type { AuditLogger } from './application/index.js';
import type { AccessService, UserBlockProvider, UserProvider, UserRole } from '../users/index.js';
import type { NotificationPublisher } from '../notifications/index.js';
import { ChangeUserBirthDateUseCase } from './application/index.js';
import { AuditLogEntity, AuditLoggerAdapter } from './infrastructure/index.js';
import { createAdminUsersController } from './presentation/http/admin-users.controller.js';
import { createAdminUsersRouter } from './presentation/http/admin-users.routes.js';
import { TypeOrmUnitOfWork } from '../../common/index.js';
import { startBatchWorker } from '../../common/start-batch-worker.js';
import { ModerationUseCase } from './application/use-cases/moderation.use-case.js';
import { ModerationStore } from './infrastructure/persistence/adapters/moderation.store.js';
import {
  createAdminModerationRouter,
  createReportsRouter
} from './presentation/http/moderation.routes.js';

interface CreateModerationModuleDependencies {
  dataSource: DataSource;
  users: UserProvider;
  access: AccessService;
  blocks: UserBlockProvider;
  notifications: NotificationPublisher;
  requireAuth: RequestHandler;
  requireRole: (...roles: UserRole[]) => RequestHandler;
}

export function createModerationModule({
  dataSource,
  users,
  access,
  blocks,
  notifications,
  requireAuth,
  requireRole
}: CreateModerationModuleDependencies) {
  const audit: AuditLogger = new AuditLoggerAdapter(dataSource.getRepository(AuditLogEntity));
  const unitOfWork = new TypeOrmUnitOfWork(dataSource);
  const moderation = new ModerationUseCase(
    new ModerationStore(dataSource),
    unitOfWork,
    audit,
    access,
    blocks,
    notifications,
    () => new Date()
  );

  const changeUserBirthDate = new ChangeUserBirthDateUseCase(unitOfWork, users, audit);

  const adminUsersController = createAdminUsersController({ changeUserBirthDate });

  const adminUsersRouter = createAdminUsersRouter({
    controller: adminUsersController,
    requireAuth,
    requireRole
  });
  adminUsersRouter.use(createAdminModerationRouter(moderation));

  return {
    audit,
    adminUsersRouter,
    reportsRouter: createReportsRouter(requireAuth, moderation),
    startBlockExpiryWorker: () =>
      startBatchWorker(() => moderation.expireBlocks(), 60_000, 'Account block expiry failed')
  };
}

export type ModerationModule = ReturnType<typeof createModerationModule>;
