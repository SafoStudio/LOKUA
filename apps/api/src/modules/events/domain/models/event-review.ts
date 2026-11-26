export interface EventReview {
  id: string;
  eventId: string;
  authorId: string;
  rating: number;
  text: string | null;
  organizerReply: string | null;
  organizerReplyAt: Date | null;
  isPinned: boolean;
  isHiddenByAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}
