import type { Request, Response } from 'express';
import type { ChangeUserBirthDateUseCase } from '../../application/index.js';
import type { ChangeBirthDateInput } from './admin-users.schema.js';
import { toAdminBirthDateView } from './admin-users.view.js';
import { AppError } from '../../../../common/index.js';

interface AdminUsersControllerDependencies {
  changeUserBirthDate: ChangeUserBirthDateUseCase;
}

export function createAdminUsersController({
  changeUserBirthDate
}: AdminUsersControllerDependencies) {
  return {
    async changeBirthDate(req: Request, res: Response): Promise<void> {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const targetUserId = req.params.id;
      if (typeof targetUserId !== 'string') {
        throw new AppError('Invalid user id', 400);
      }

      const body = req.body as ChangeBirthDateInput;

      const updated = await changeUserBirthDate.execute({
        actorId: req.user.id,
        targetUserId,
        birthDate: new Date(`${body.birthDate}T00:00:00.000Z`),
        reason: body.reason,
        ip: req.ip ?? null
      });

      res.status(200).json({ data: toAdminBirthDateView(updated) });
    }
  };
}

export type AdminUsersController = ReturnType<typeof createAdminUsersController>;
