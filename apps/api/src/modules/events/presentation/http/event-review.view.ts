import type { EventReview } from '../../domain/models/event-review.js';

export function toReviewView({
  review,
  author
}: {
  review: EventReview & { eventTitle?: string };
  author: { id: string | null; name: string | null; avatarUrl: string | null };
}) {
  return {
    id: review.id,
    eventId: review.eventId,
    eventTitle: review.eventTitle,
    author,
    rating: review.rating,
    text: review.text,
    organizerReply: review.organizerReply,
    organizerReplyAt: review.organizerReplyAt,
    isPinned: review.isPinned,
    createdAt: review.createdAt
  };
}

export function toReviewPageView({
  items,
  nextCursor
}: {
  items: Parameters<typeof toReviewView>[0][];
  nextCursor: string | null;
}) {
  return {
    data: items.map(toReviewView),
    pagination: { nextCursor, hasMore: nextCursor !== null }
  };
}
