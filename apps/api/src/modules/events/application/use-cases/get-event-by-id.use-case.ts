import { AppError } from '../../../../common/index.js';
import { obfuscateCoordinates } from '../../../geolocation/index.js';
import type { LocationProvider } from '../../../geolocation/index.js';
import type {
  AccessService,
  AuthUser,
  UserBlockProvider,
  UserProfileProvider
} from '../../../users/index.js';
import type { EventLocationSnapshot } from '../ports/event.repository.js';
import type { EventManagementRepository } from '../ports/event-management.repository.js';
import type { EventParticipationRepository } from '../ports/event-participation.repository.js';
import type { EventReviewsUseCase } from './event-reviews.use-case.js';

export class GetEventByIdUseCase {
  constructor(
    private readonly events: Pick<
      EventManagementRepository,
      'readTags' | 'hasForeignPrivateLocation'
    > &
      Pick<
        EventParticipationRepository,
        'findEvent' | 'findParticipation' | 'countApproved' | 'listParticipations'
      > & {
        findLocationSnapshot(
          eventId: string,
          locationId: string
        ): Promise<EventLocationSnapshot | null>;
      },
    private readonly access: AccessService,
    private readonly blocks: UserBlockProvider,
    private readonly profiles: UserProfileProvider,
    private readonly locations: Pick<LocationProvider, 'findById'>,
    private readonly reviews: Pick<EventReviewsUseCase, 'rating' | 'preview' | 'canReview'>,
    private readonly clock: () => Date
  ) {}

  async execute(id: string, user: AuthUser | null) {
    const event = await this.events.findEvent(id);
    if (!event) throw new AppError('Event not found', 404);

    const viewer = user && !this.access.isBlocked(user) ? user : null;
    const owner = viewer?.id === event.organizerId;
    const admin = viewer !== null && this.access.canAccessAdmin(viewer, 'ADMIN');
    const privileged = owner || admin;
    if (event.status === 'DRAFT') {
      if (!privileged) throw new AppError('Event not found', 404);
      const locationId = event.primaryLocationId;
      const [tags, location] = await Promise.all([
        this.events.readTags(id),
        locationId &&
        (admin || !(await this.events.hasForeignPrivateLocation(locationId, event.organizerId)))
          ? this.locations.findById(locationId)
          : null
      ]);
      return {
        kind: 'DRAFT' as const,
        event: { ...event, tags },
        location: location
          ? this.toLocation({ ...location, coordinates: location.exactCoordinates }, true)
          : null
      };
    }

    const now = this.clock();
    const blockedIds = viewer ? await this.blocks.listRelatedUserIds(viewer.id) : [];
    if (
      !privileged &&
      (event.isHiddenByAdmin ||
        blockedIds.includes(event.organizerId) ||
        !this.access.canViewEvent(viewer, event.ageRestriction, now))
    ) {
      throw new AppError('Event not found', 404);
    }

    const participation =
      viewer && !owner ? await this.events.findParticipation(id, viewer.id) : null;
    const participationStatus = participation?.status ?? null;
    const approved = participationStatus === 'APPROVED';
    const pending = participationStatus === 'PENDING';
    if (event.status === 'CANCELLED' && !privileged && !approved && !pending) {
      throw new AppError('Event not found', 404);
    }

    const canSeeExact = privileged || approved;
    const locationId = event.primaryLocationId;
    const [
      tags,
      organizer,
      approvedParticipantCount,
      snapshot,
      participants,
      foreignPrivateLocation,
      rating,
      reviews,
      canReview
    ] = await Promise.all([
      this.events.readTags(id),
      this.profiles.findByUserId(event.organizerId),
      this.events.countApproved(event),
      locationId ? this.events.findLocationSnapshot(id, locationId) : null,
      viewer
        ? this.events.listParticipations({
            eventId: id,
            status: 'APPROVED',
            limit: 5,
            excludedUserIds: [event.organizerId, ...blockedIds]
          })
        : [],
      !admin && locationId
        ? this.events.hasForeignPrivateLocation(locationId, event.organizerId)
        : false,
      this.reviews.rating(event.organizerId),
      event.status === 'COMPLETED'
        ? this.reviews.preview(event.organizerId, blockedIds, id)
        : { items: [], nextCursor: null },
      viewer && approved ? this.reviews.canReview(event, viewer.id, now) : false
    ]);
    const exactLocation = !foreignPrivateLocation && (!event.hideExactAddress || canSeeExact);
    const participantAvatars = await Promise.all(
      participants.map(async ({ userId }) => ({
        id: userId,
        avatarUrl: (await this.profiles.findByUserId(userId))?.avatarUrl ?? null
      }))
    );
    const availablePlaces =
      event.capacityLimit === null
        ? null
        : Math.max(0, event.capacityLimit - approvedParticipantCount);
    const open =
      (event.status === 'PUBLISHED' || event.status === 'FULL') &&
      event.firstStartsAt !== null &&
      event.firstStartsAt > now &&
      event.firstEndsAt !== null;
    const canJoin =
      viewer !== null &&
      !owner &&
      !event.isHiddenByAdmin &&
      open &&
      !blockedIds.includes(event.organizerId) &&
      this.access.canViewEvent(viewer, event.ageRestriction, now) &&
      this.access.canJoinEvent(viewer, event.ageRestriction, now) &&
      participationStatus === null;

    return {
      kind: 'DETAIL' as const,
      event,
      tags,
      organizer: {
        id: event.organizerId,
        name: organizer?.name ?? null,
        avatarUrl: organizer?.avatarUrl ?? null,
        ...rating
      },
      reviews,
      approvedParticipantCount,
      availablePlaces,
      participantAvatars,
      participationStatus,
      actions: {
        canJoin: canJoin && event.participationMode === 'FREE' && availablePlaces !== 0,
        canApply: canJoin && event.participationMode === 'REQUEST',
        canCancelParticipation: open && (approved || pending),
        canReview
      },
      location:
        event.format === 'OFFLINE' && snapshot ? this.toLocation(snapshot, exactLocation) : null,
      onlineUrl: event.format === 'ONLINE' && canSeeExact ? event.onlineUrl : null
    };
  }

  private toLocation(snapshot: EventLocationSnapshot, exact: boolean) {
    const { cityId, districtId, countryCode } = snapshot;
    return {
      cityId,
      districtId,
      countryCode,
      isExact: exact,
      coordinates: exact ? snapshot.coordinates : obfuscateCoordinates(snapshot.publicCoordinates),
      name: exact ? snapshot.name : null,
      address: exact ? snapshot.address : null
    };
  }
}
