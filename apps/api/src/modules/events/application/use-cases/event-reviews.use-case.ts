import { AppError } from '../../../../common/index.js';
import type { TransactionContext, UnitOfWork } from '../../../../common/index.js';
import type {
  AccessService,
  AuthUser,
  UserBlockProvider,
  UserProfileProvider
} from '../../../users/index.js';
import type { AgeRestriction, Event } from '../../domain/index.js';
import type { EventReview } from '../../domain/models/event-review.js';
import type { EventManagementRepository } from '../ports/event-management.repository.js';
import type { EventParticipationRepository } from '../ports/event-participation.repository.js';
import type { NotificationPublisher } from '../../../notifications/index.js';
import { publishEventNotification } from '../publish-event-notification.js';
import type {
  EventReviewRepository,
  ReviewListQuery,
  ReviewPageQuery
} from '../ports/event-review.repository.js';

const reviewWindowMs = 7 * 24 * 60 * 60 * 1000;
const pinLimit = 3;
const previewLimit = 3;
const reviewAgeRestrictions: AgeRestriction[] = ['ALL', 'SIXTEEN_PLUS', 'EIGHTEEN_PLUS'];

export class EventReviewsUseCase {
  constructor(
    private readonly events: Pick<EventParticipationRepository, 'findEvent'> & {
      inTransaction(
        tx: TransactionContext
      ): Pick<EventParticipationRepository, 'lockEvent' | 'findParticipation'> &
        Pick<EventManagementRepository, 'lockOrganizer'>;
    },
    private readonly reviews: EventReviewRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly access: AccessService,
    private readonly blocks: UserBlockProvider,
    private readonly profiles: UserProfileProvider,
    private readonly clock: () => Date,
    private readonly notifications?: NotificationPublisher
  ) {}

  rating(organizerId: string) {
    return this.reviews.getOrganizerRating(organizerId);
  }

  eventRating(eventId: string) {
    return this.reviews.getEventRating(eventId);
  }

  preview(organizerId: string, blockedAuthorIds: string[], eventId: string) {
    return this.page({ organizerId, blockedAuthorIds, eventId, limit: previewLimit });
  }

  organizerPreview(
    organizerId: string,
    user: AuthUser | null,
    blockedAuthorIds: string[],
    now: Date
  ) {
    return this.page({
      organizerId,
      blockedAuthorIds,
      ageRestrictions: this.visibleAgeRestrictions(organizerId, user, now),
      limit: previewLimit
    });
  }

  async canReview(event: Event, authorId: string, now: Date): Promise<boolean> {
    return (
      event.organizerId !== authorId &&
      this.isReviewWindowOpen(event, now) &&
      !(await this.reviews.findByAuthor(event.id, authorId))
    );
  }

  async listForEvent(eventId: string, user: AuthUser | null, query: ReviewPageQuery) {
    const event = await this.events.findEvent(eventId);
    if (!event || event.status !== 'COMPLETED') throw new AppError('Event not found', 404);
    const [blockerIds, blockedAuthorIds] = user
      ? await Promise.all([
          this.blocks.listBlockerIds(user.id),
          this.blocks.listRelatedUserIds(user.id)
        ])
      : [[], []];
    this.ensureEventVisibility(event, user, blockerIds, this.clock());
    return this.page({ ...query, organizerId: event.organizerId, eventId, blockedAuthorIds });
  }

  async profile(organizerId: string, user: AuthUser | null) {
    const { profile, filters } = await this.profileContext(organizerId, user);
    const [rating, reviews] = await Promise.all([
      this.rating(organizerId),
      this.page({ ...filters, limit: previewLimit })
    ]);
    return { profile, rating, reviews };
  }

  async listForOrganizer(organizerId: string, user: AuthUser | null, query: ReviewPageQuery) {
    const { filters } = await this.profileContext(organizerId, user);
    return this.page({ ...query, ...filters });
  }

  async create(user: AuthUser, eventId: string, rating: number, text: string | null) {
    const review = await this.unitOfWork.run(async (tx) => {
      const { event, reviews } = await this.reviewContext(user, eventId, tx);
      if (await reviews.findByAuthor(eventId, user.id)) {
        throw new AppError('The participant has already reviewed this event', 409);
      }
      const saved = await reviews.create({ eventId, authorId: user.id, rating, text });
      await publishEventNotification(this.notifications, tx, event, 'NEW_REVIEW', [
        event.organizerId
      ]);
      return saved;
    });
    return this.withAuthor(review);
  }

  async edit(
    user: AuthUser,
    eventId: string,
    reviewId: string,
    patch: { rating?: number; text?: string | null }
  ) {
    const review = await this.unitOfWork.run(async (tx) => {
      const { reviews } = await this.reviewContext(user, eventId, tx);
      const current = await reviews.find(eventId, reviewId);
      if (!current || current.authorId !== user.id || current.isHiddenByAdmin) {
        throw new AppError('Review not found', 404);
      }
      return reviews.save({
        ...current,
        rating: patch.rating ?? current.rating,
        text: patch.text === undefined ? current.text : patch.text
      });
    });
    return this.withAuthor(review);
  }

  async reply(user: AuthUser, eventId: string, reviewId: string, text: string) {
    const review = await this.unitOfWork.run(async (tx) => {
      const { event, reviews, current } = await this.lockOwnedReview(user, eventId, reviewId, tx);
      if (current.organizerReply !== null)
        throw new AppError('The review already has a reply', 409);
      const saved = await reviews.save({
        ...current,
        organizerReply: text,
        organizerReplyAt: this.clock()
      });
      await publishEventNotification(this.notifications, tx, event, 'REVIEW_REPLY', [
        saved.authorId
      ]);
      return saved;
    });
    return this.withAuthor(review);
  }

  async pin(user: AuthUser, eventId: string, reviewId: string, isPinned: boolean) {
    const review = await this.unitOfWork.run(async (tx) => {
      await this.events.inTransaction(tx).lockOrganizer(user.id);
      const { reviews, current } = await this.lockOwnedReview(user, eventId, reviewId, tx);
      if (current.isPinned === isPinned) return current;
      if (isPinned && (await reviews.countPinned(user.id)) >= pinLimit) {
        throw new AppError('The organizer can pin at most three reviews', 409);
      }
      return reviews.save({ ...current, isPinned });
    });
    return this.withAuthor(review);
  }

  private async page(query: ReviewListQuery) {
    const rows = await this.reviews.list({ ...query, limit: query.limit + 1 });
    const page = rows.slice(0, query.limit);
    const authors = new Map<string, ReturnType<EventReviewsUseCase['author']>>();
    const items = await Promise.all(
      page.map(async (review) => {
        let author = authors.get(review.authorId);
        if (!author) {
          author = this.author(review.authorId);
          authors.set(review.authorId, author);
        }
        return { review, author: await author };
      })
    );
    return {
      items,
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null
    };
  }

  private async profileContext(organizerId: string, user: AuthUser | null) {
    const blockedAuthorIds = user ? await this.blocks.listRelatedUserIds(user.id) : [];
    if (blockedAuthorIds.includes(organizerId)) throw new AppError('Profile not found', 404);
    const profile = await this.profiles.findByUserId(organizerId);
    if (!profile || profile.status === 'PENDING_DELETION' || profile.status === 'DELETED') {
      throw new AppError('Profile not found', 404);
    }
    const ageRestrictions = this.visibleAgeRestrictions(organizerId, user, this.clock());
    return { profile, filters: { organizerId, blockedAuthorIds, ageRestrictions } };
  }

  private visibleAgeRestrictions(organizerId: string, user: AuthUser | null, now: Date) {
    return user?.id === organizerId || (user && this.access.canAccessAdmin(user, 'ADMIN'))
      ? undefined
      : reviewAgeRestrictions.filter((restriction) =>
          this.access.canViewEvent(user, restriction, now)
        );
  }

  private async reviewContext(user: AuthUser, eventId: string, tx: TransactionContext) {
    const { event, events } = await this.lockCompletedEvent(eventId, tx);
    const now = this.clock();
    const blockedIds = await this.blocks.listBlockerIds(user.id, tx);
    this.ensureEventVisibility(event, user, blockedIds, now);
    if (
      !this.access.canPostEventContent(user) ||
      event.organizerId === user.id ||
      (await events.findParticipation(eventId, user.id))?.status !== 'APPROVED'
    ) {
      throw new AppError(
        'Approved participation and an eligible account are required to review the event',
        403
      );
    }
    if (!this.isReviewWindowOpen(event, now))
      throw new AppError('The review period is closed', 409);
    return { event, reviews: this.reviews.inTransaction(tx) };
  }

  private ensureEventVisibility(
    event: Event,
    user: AuthUser | null,
    blockedIds: string[],
    now: Date
  ) {
    if (user?.id === event.organizerId || (user && this.access.canAccessAdmin(user, 'ADMIN')))
      return;
    if (
      event.isHiddenByAdmin ||
      blockedIds.includes(event.organizerId) ||
      !this.access.canViewEvent(user, event.ageRestriction, now)
    ) {
      throw new AppError('Event not found', 404);
    }
  }

  private isReviewWindowOpen(event: Event, now: Date): boolean {
    const endsAt = event.firstEndsAt?.getTime();
    return (
      event.status === 'COMPLETED' &&
      endsAt !== undefined &&
      now.getTime() >= endsAt &&
      now.getTime() < endsAt + reviewWindowMs
    );
  }

  private async lockCompletedEvent(eventId: string, tx: TransactionContext) {
    const events = this.events.inTransaction(tx);
    const event = await events.lockEvent(eventId);
    if (!event || event.status !== 'COMPLETED') throw new AppError('Event not found', 404);
    return { event, events };
  }

  private async lockOwnedReview(
    user: AuthUser,
    eventId: string,
    reviewId: string,
    tx: TransactionContext
  ) {
    const { event } = await this.lockCompletedEvent(eventId, tx);
    if (event.organizerId !== user.id) throw new AppError('Review not found', 404);
    const reviews = this.reviews.inTransaction(tx);
    const current = await reviews.find(eventId, reviewId);
    if (!current || current.isHiddenByAdmin) throw new AppError('Review not found', 404);
    return { event, reviews, current };
  }

  private async withAuthor(review: EventReview) {
    return { review, author: await this.author(review.authorId) };
  }

  private async author(id: string) {
    const profile = await this.profiles.findByUserId(id);
    if (profile?.status === 'DELETED') {
      return { id: null, name: profile.name, avatarUrl: null };
    }
    return { id, name: profile?.name ?? null, avatarUrl: profile?.avatarUrl ?? null };
  }
}
