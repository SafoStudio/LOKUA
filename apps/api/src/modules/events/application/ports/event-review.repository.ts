import type { TransactionContext } from '../../../../common/index.js';
import type { AgeRestriction } from '../../domain/index.js';
import type { EventReview } from '../../domain/models/event-review.js';

export interface ReviewPageQuery {
  limit: number;
  cursor?: string;
}

export interface ReviewListQuery extends ReviewPageQuery {
  organizerId: string;
  eventId?: string;
  blockedAuthorIds: string[];
  ageRestrictions?: AgeRestriction[];
}

export interface OrganizerRating {
  rating: number | null;
  ratingCount: number;
}

export interface EventReviewRepository {
  inTransaction(tx: TransactionContext): EventReviewRepository;
  find(eventId: string, reviewId: string): Promise<EventReview | null>;
  findByAuthor(eventId: string, authorId: string): Promise<EventReview | null>;
  create(
    review: Pick<EventReview, 'eventId' | 'authorId' | 'rating' | 'text'>
  ): Promise<EventReview>;
  save(review: EventReview): Promise<EventReview>;
  countPinned(organizerId: string): Promise<number>;
  getOrganizerRating(organizerId: string): Promise<OrganizerRating>;
  list(query: ReviewListQuery): Promise<EventReview[]>;
}
