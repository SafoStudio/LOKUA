import { AppError } from '../../../../common/index.js';
import type { AccessService, AuthUser, UserBlockProvider } from '../../../users/index.js';
import type { AgeRestriction } from '../../domain/index.js';
import type { MyEventsQuery, MyEventsRepository } from '../ports/my-events.repository.js';

export class GetMyEventsUseCase {
  constructor(
    private readonly events: MyEventsRepository,
    private readonly access: AccessService,
    private readonly blocks: UserBlockProvider,
    private readonly clock: () => Date
  ) {}

  async execute(user: AuthUser, query: MyEventsQuery) {
    if (this.access.isBlocked(user)) throw new AppError('Account is blocked', 403);

    const now = this.clock();
    const restrictions: AgeRestriction[] = ['ALL', 'SIXTEEN_PLUS', 'EIGHTEEN_PLUS'];
    return this.events.findMyEvents({
      ...query,
      userId: user.id,
      now,
      blockedOrganizerIds: await this.blocks.listRelatedUserIds(user.id),
      ageRestrictions: restrictions.filter((restriction) =>
        this.access.canViewEvent(user, restriction, now)
      )
    });
  }
}
