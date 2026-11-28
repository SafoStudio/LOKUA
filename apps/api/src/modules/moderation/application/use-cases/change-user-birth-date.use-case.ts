import type { UnitOfWork } from '../../../../common/index.js';
import type { AuditLogger } from '../ports/audit-logger.js';
import type { User, UserProvider } from '../../../users/index.js';
import { AppError } from '../../../../common/index.js';

export interface ChangeUserBirthDateCommand {
  actorId: string;
  targetUserId: string;
  birthDate: Date;
  reason: string;
  ip: string | null;
}

export class ChangeUserBirthDateUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly users: UserProvider,
    private readonly audit: AuditLogger
  ) {}

  async execute(command: ChangeUserBirthDateCommand): Promise<User> {
    return this.unitOfWork.run(async (tx) => {
      const target = await this.users.findById(command.targetUserId, tx, true);
      if (!target) throw new AppError('User not found', 404);

      const updated = await this.users.setBirthDate(command.targetUserId, command.birthDate, tx);

      await this.audit.log(
        {
          actorId: command.actorId,
          action: 'USER_BIRTH_DATE_CHANGED',
          targetType: 'USER',
          targetId: command.targetUserId,
          beforeState: {
            birthDate: target.birthDate ? target.birthDate.toISOString().slice(0, 10) : null
          },
          afterState: {
            birthDate: command.birthDate.toISOString().slice(0, 10)
          },
          reason: command.reason,
          ip: command.ip
        },
        tx
      );

      return updated;
    });
  }
}
