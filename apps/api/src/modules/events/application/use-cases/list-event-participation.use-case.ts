import { AppError } from '../../../../common/index.js';
import { calculateAge } from '../../../users/index.js';
import type {
  AccessService,
  AuthUser,
  UserBlockProvider,
  UserProfileProvider
} from '../../../users/index.js';
import type { EventParticipationRepository } from '../ports/event-participation.repository.js';
import { eventPerson } from '../event-person.js';

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
    const now = this.clock();
    const applications = kind === 'APPLICATIONS';
    let blockedUserIds: string[] = [];
    if (applications) {
      if (!owner) throw new AppError('Event not found', 404);
    } else if (!admin) {
      if (event.isHiddenByAdmin) throw new AppError('Event not found', 404);
      if (!owner) {
        const blockerIds = await this.blocks.listBlockerIds(user.id);
        if (
          blockerIds.includes(event.organizerId) ||
          !this.access.canViewEvent(user, event.ageRestriction, now)
        ) {
          throw new AppError('Event not found', 404);
        }
        const ownParticipation = await this.events.findParticipation(eventId, user.id);
        if (ownParticipation?.status !== 'APPROVED') {
          throw new AppError('Participant access is required', 403);
        }
        blockedUserIds = await this.blocks.listRelatedUserIds(user.id);
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
          profile: await this.profile(participation.userId, now)
        }))
      ),
      applications ? null : this.profile(event.organizerId, now)
    ]);
    return {
      items,
      organizer,
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null
    };
  }

  private async profile(userId: string, now: Date) {
    const profile = await this.profiles.findByUserId(userId);
    const person = eventPerson(userId, profile);
    const details = profile?.status === 'ACTIVE' ? profile : null;
    const socialLinks = details?.socialLinks;
    return {
      id: person.id,
      name: details?.name ?? (profile?.status === 'DELETED' ? person.name : null),
      avatarUrl: details?.avatarUrl ?? null,
      age: calculateAge(details?.birthDate ?? null, now),
      photoUrls: details?.photoUrls ?? [],
      cityId: details?.cityId ?? null,
      interestIds: details?.interestIds ?? [],
      bio: details?.bio ?? null,
      languages: details?.languages ?? null,
      socialLinks: socialLinks
        ? Object.fromEntries(
            Object.entries(socialLinks).filter(([, url]) => /^https?:\/\//i.test(url))
          )
        : null
    };
  }
}
