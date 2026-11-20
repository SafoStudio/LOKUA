import type { DataSource } from 'typeorm';
import type { RequestHandler } from 'express';
import type { AuditLogger } from './application/index.js';
import type { UserProvider, UserRole } from '../users/index.js';
import { ChangeUserBirthDateUseCase } from './application/index.js';
import { AuditLogEntity, AuditLoggerAdapter } from './infrastructure/index.js';
import { createAdminUsersController } from './presentation/http/admin-users.controller.js';
import { createAdminUsersRouter } from './presentation/http/admin-users.routes.js';
import { TypeOrmUnitOfWork } from '../../common/index.js';

interface CreateModerationModuleDependencies {
  dataSource: DataSource;
  users: UserProvider;
  requireAuth: RequestHandler;
  requireRole: (...roles: UserRole[]) => RequestHandler;
}

export function createModerationModule({
  dataSource,
  users,
  requireAuth,
  requireRole
}: CreateModerationModuleDependencies) {
  const audit: AuditLogger = new AuditLoggerAdapter(dataSource.getRepository(AuditLogEntity));
  const unitOfWork = new TypeOrmUnitOfWork(dataSource);

  const changeUserBirthDate = new ChangeUserBirthDateUseCase(unitOfWork, users, audit);

  const adminUsersController = createAdminUsersController({ changeUserBirthDate });

  const adminUsersRouter = createAdminUsersRouter({
    controller: adminUsersController,
    requireAuth,
    requireRole
  });

  return {
    audit,
    adminUsersRouter
  };
}

export type ModerationModule = ReturnType<typeof createModerationModule>;
