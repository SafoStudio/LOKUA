import { AppError } from '../../../../common/index.js';
import type {
  AccessService,
  AuthUser,
  UserBlockProvider,
  UserProfileProvider
} from '../../../users/index.js';
import type { EventParticipationRepository } from '../ports/event-participation.repository.js';

export interface ParticipationPageQuery {
  limit: number;
  cursor?: string;
}

export class ListEventParticipationUseCase {
  constructor(
    private readonly events: EventParticipationRepository,
    private readonly access: AccessService,
    private readonly blocks: UserBlockProvider,
    private readonly profiles: UserProfileProvider,
    private readonly clock: () => Date
  ) {}

  async execute(
    user: AuthUser,
    eventId: string,
    kind: 'APPLICATIONS' | 'PARTICIPANTS',
    query: ParticipationPageQuery
  ) {
    const event = await this.events.findEvent(eventId);
    if (!event || event.status === 'DRAFT') throw new AppError('Event not found', 404);

    const owner = event.organizerId === user.id;
    const admin = this.access.canAccessAdmin(user, 'ADMIN');
    const applications = kind === 'APPLICATIONS';
    let blockedUserIds: string[] = [];
    if (applications) {
      if (!owner) throw new AppError('Event not found', 404);
    } else if (!admin) {
      if (event.isHiddenByAdmin) throw new AppError('Event not found', 404);
      if (!owner) {
        blockedUserIds = await this.blocks.listRelatedUserIds(user.id);
        if (
          blockedUserIds.includes(event.organizerId) ||
          !this.access.canViewEvent(user, event.ageRestriction, this.clock())
        ) {
          throw new AppError('Event not found', 404);
        }
        const ownParticipation = await this.events.findParticipation(eventId, user.id);
        if (ownParticipation?.status !== 'APPROVED') {
          throw new AppError('Participant access is required', 403);
        }
      }
    }

    const rows = await this.events.listParticipations({
      eventId,
      status: applications ? 'PENDING' : 'APPROVED',
      after: query.cursor,
      limit: query.limit + 1,
      excludedUserIds: [event.organizerId, ...blockedUserIds]
    });
    const page = rows.slice(0, query.limit);
    const [items, organizer] = await Promise.all([
      Promise.all(
        page.map(async (participation) => ({
          participation,
          profile: await this.profile(participation.userId)
        }))
      ),
      applications ? null : this.profile(event.organizerId)
    ]);
    return {
      items,
      organizer,
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null
    };
  }

  private async profile(userId: string) {
    const profile = await this.profiles.findByUserId(userId);
    return {
      id: userId,
      name: profile?.name ?? null,
      avatarUrl: profile?.avatarUrl ?? null
    };
  }
}
