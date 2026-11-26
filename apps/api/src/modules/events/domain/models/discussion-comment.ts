export interface DiscussionComment {
  id: string;
  eventId: string;
  authorId: string;
  parentId: string | null;
  text: string;
  isEdited: boolean;
  isArchived: boolean;
  isHiddenByAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}
