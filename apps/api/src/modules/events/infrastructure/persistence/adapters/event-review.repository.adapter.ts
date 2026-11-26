import type { Repository } from 'typeorm';
import { toEntityManager } from '../../../../../common/index.js';
import type { TransactionContext } from '../../../../../common/index.js';
import type {
  EventReviewRepository,
  OrganizerRating,
  ReviewListQuery
} from '../../../application/ports/event-review.repository.js';
import type { EventReview } from '../../../domain/models/event-review.js';
import { EventEntity } from '../entities/event.entity.js';
import { EventReviewEntity } from '../entities/event-review.entity.js';

export class EventReviewRepositoryAdapter implements EventReviewRepository {
  constructor(private readonly repository: Repository<EventReviewEntity>) {}

  inTransaction(tx: TransactionContext): EventReviewRepositoryAdapter {
    return new EventReviewRepositoryAdapter(toEntityManager(tx).getRepository(EventReviewEntity));
  }

  find(eventId: string, reviewId: string): Promise<EventReview | null> {
    return this.repository.findOneBy({ eventId, id: reviewId });
  }

  findByAuthor(eventId: string, authorId: string): Promise<EventReview | null> {
    return this.repository.findOneBy({ eventId, authorId });
  }

  create(review: Parameters<EventReviewRepository['create']>[0]): Promise<EventReview> {
    return this.repository.save(
      this.repository.create({
        ...review,
        organizerReply: null,
        organizerReplyAt: null,
        isPinned: false,
        isHiddenByAdmin: false
      })
    );
  }

  save(review: EventReview): Promise<EventReview> {
    return this.repository.save(review);
  }

  countPinned(organizerId: string): Promise<number> {
    return this.organizerReviews(organizerId).andWhere('review.is_pinned').getCount();
  }

  async getOrganizerRating(organizerId: string): Promise<OrganizerRating> {
    const result = await this.organizerReviews(organizerId)
      .andWhere("event.status = 'COMPLETED'")
      .andWhere('NOT event.is_hidden_by_admin AND NOT review.is_hidden_by_admin')
      .select('COUNT(*)', 'rating_count')
      .addSelect('ROUND(AVG(review.rating), 1)', 'rating')
      .getRawOne<{ rating_count: string; rating: string | null }>();
    const ratingCount = Number(result?.rating_count ?? 0);
    return {
      ratingCount,
      rating: ratingCount >= 3 && result?.rating != null ? Number(result.rating) : null
    };
  }

  list(query: ReviewListQuery): Promise<EventReview[]> {
    const { organizerId, eventId, blockedAuthorIds, ageRestrictions, cursor, limit } = query;
    const builder = this.organizerReviews(organizerId)
      .andWhere("event.status = 'COMPLETED'")
      .andWhere('NOT review.is_hidden_by_admin')
      .orderBy('review.isPinned', 'DESC')
      .addOrderBy('review.createdAt', 'DESC')
      .addOrderBy('review.id', 'DESC')
      .limit(limit);
    if (eventId) {
      builder.andWhere('review.event_id = :eventId', { eventId });
    } else {
      builder.andWhere('NOT event.is_hidden_by_admin');
    }
    if (ageRestrictions) {
      if (ageRestrictions.length === 0) return Promise.resolve([]);
      builder.andWhere('event.age_restriction IN (:...ageRestrictions)', { ageRestrictions });
    }
    if (blockedAuthorIds.length) {
      builder.andWhere('review.author_id NOT IN (:...blockedAuthorIds)', { blockedAuthorIds });
    }
    if (cursor) {
      builder.andWhere(
        `(review.is_pinned, review.created_at, review.id) < (
           SELECT anchor.is_pinned, anchor.created_at, anchor.id
           FROM event_reviews anchor
           JOIN events anchor_event ON anchor_event.id = anchor.event_id
           WHERE anchor.id = :cursor AND anchor_event.organizer_id = :organizerId
             ${eventId ? 'AND anchor.event_id = :eventId' : ''}
         )`,
        { cursor }
      );
    }
    return builder.getMany();
  }

  private organizerReviews(organizerId: string) {
    return this.repository
      .createQueryBuilder('review')
      .innerJoin(EventEntity, 'event', 'event.id = review.event_id')
      .where('event.organizer_id = :organizerId', { organizerId });
  }
}
