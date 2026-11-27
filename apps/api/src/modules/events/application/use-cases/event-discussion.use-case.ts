import { AppError } from '../../../../common/index.js';
import type { TransactionContext, UnitOfWork } from '../../../../common/index.js';
import type {
  AccessService,
  AuthUser,
  UserBlockProvider,
  UserProfileProvider
} from '../../../users/index.js';
import type { Event } from '../../domain/index.js';
import type { DiscussionComment } from '../../domain/models/discussion-comment.js';
import type {
  DiscussionCommentRepository,
  DiscussionQuery
} from '../ports/discussion-comment.repository.js';
import type { EventParticipationRepository } from '../ports/event-participation.repository.js';
import type { NotificationPublisher } from '../../../notifications/index.js';
import { publishEventNotification } from '../publish-event-notification.js';

const postingLimit = 20;
const postingWindowMs = 60 * 60 * 1000;

export class EventDiscussionUseCase {
  constructor(
    private readonly events: EventParticipationRepository,
    private readonly comments: DiscussionCommentRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly access: AccessService,
    private readonly blocks: UserBlockProvider,
    private readonly profiles: UserProfileProvider,
    private readonly clock: () => Date,
    private readonly notifications?: NotificationPublisher
  ) {}

  async list(eventId: string, user: AuthUser | null, query: DiscussionQuery) {
    if (user && this.access.isBlocked(user)) throw new AppError('Account is blocked', 403);
    if (query.archive) {
      if (!user) throw new AppError('Authentication required', 401);
      if (!this.access.canAccessAdmin(user, 'ADMIN')) {
        throw new AppError('Administrator access is required', 403);
      }
    }

    const event = await this.events.findEvent(eventId);
    const now = this.clock();
    if (!event || (query.archive && !this.isCompleted(event, now))) {
      throw new AppError('Discussion not found', 404);
    }
    const blockedIds = query.archive ? [] : await this.visibleDiscussion(event, user, now);

    if (query.parentId) {
      const parent = await this.comments.find(eventId, query.parentId);
      if (
        !parent ||
        parent.parentId !== null ||
        (!query.archive && !this.canReadComment(parent, blockedIds))
      ) {
        throw new AppError('Comment not found', 404);
      }
    }
    const rows = await this.comments.list({
      ...query,
      eventId,
      limit: query.limit + 1,
      excludedAuthorIds: blockedIds
    });
    const page = rows.slice(0, query.limit);
    const authors = new Map(
      await Promise.all(
        [...new Set(page.map((comment) => comment.authorId))].map(
          async (id) => [id, await this.author(id)] as const
        )
      )
    );
    return {
      items: page.map((comment) => ({
        comment,
        author: authors.get(comment.authorId) ?? null,
        isOrganizer: comment.authorId === event.organizerId
      })),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null
    };
  }

  async create(user: AuthUser, eventId: string, text: string, parentId?: string) {
    const { comment, isOrganizer } = await this.unitOfWork.run(async (tx) => {
      const comments = this.comments.inTransaction(tx);
      await comments.lockAuthor(user.id);
      const { event, now, blockedIds } = await this.openDiscussion(user, eventId, tx);
      if (!this.access.canPostEventContent(user)) {
        throw new AppError('The account is not eligible to post comments', 403);
      }
      let parentAuthorId: string | undefined;
      if (parentId) {
        const parent = await comments.find(eventId, parentId);
        if (!parent || !this.canReadComment(parent, blockedIds)) {
          throw new AppError('Comment not found', 404);
        }
        if (parent.parentId !== null) throw new AppError('Replies cannot have replies', 422);
        parentAuthorId = parent.authorId;
      }
      const windowStart = new Date(now.getTime() - postingWindowMs);
      if (!(await comments.consumeQuota(user.id, now, windowStart, postingLimit))) {
        throw new AppError('Comment posting limit exceeded', 429);
      }
      const saved = await comments.create({
        eventId,
        authorId: user.id,
        parentId: parentId ?? null,
        text,
        createdAt: now
      });
      if (event.organizerId !== user.id) {
        await publishEventNotification(this.notifications, tx, event, 'NEW_COMMENT', [
          event.organizerId
        ]);
      }
      if (parentAuthorId && parentAuthorId !== user.id) {
        await publishEventNotification(this.notifications, tx, event, 'COMMENT_REPLY', [
          parentAuthorId
        ]);
      }
      return { comment: saved, isOrganizer: event.organizerId === user.id };
    });
    return { comment, author: await this.author(comment.authorId), isOrganizer };
  }

  async edit(user: AuthUser, eventId: string, commentId: string, text: string) {
    const { comment, isOrganizer } = await this.changeComment(
      user,
      eventId,
      commentId,
      async (comments, current, event) => {
        if (!this.access.canPostEventContent(user)) {
          throw new AppError('The account is not eligible to edit comments', 403);
        }
        if (current.isArchived) throw new AppError('Comment not found', 404);
        if (current.authorId !== user.id)
          throw new AppError('Only the author can edit a comment', 403);
        const comment =
          current.text === text
            ? current
            : await comments.save({ ...current, text, isEdited: true });
        return { comment, isOrganizer: event.organizerId === current.authorId };
      }
    );
    return { comment, author: await this.author(comment.authorId), isOrganizer };
  }

  async remove(user: AuthUser, eventId: string, commentId: string) {
    await this.changeComment(
      user,
      eventId,
      commentId,
      async (comments, comment, event) => {
        if (comment.authorId !== user.id && event.organizerId !== user.id) {
          throw new AppError('Comment removal is not allowed', 403);
        }
        if (!comment.isArchived) await comments.save({ ...comment, isArchived: true });
      },
      true
    );
  }

  private changeComment<T>(
    user: AuthUser,
    eventId: string,
    commentId: string,
    change: (
      comments: DiscussionCommentRepository,
      comment: DiscussionComment,
      event: Event
    ) => Promise<T>,
    allowOrganizerModeration = false
  ): Promise<T> {
    return this.unitOfWork.run(async (tx) => {
      const { event, blockedIds } = await this.openDiscussion(user, eventId, tx);
      const comments = this.comments.inTransaction(tx);
      const comment = await comments.find(eventId, commentId);
      if (!comment) throw new AppError('Comment not found', 404);
      const canModerate = allowOrganizerModeration && event.organizerId === user.id;
      if (!canModerate && (comment.isHiddenByAdmin || blockedIds.includes(comment.authorId))) {
        throw new AppError('Comment not found', 404);
      }
      if (!canModerate && comment.parentId) {
        const parent = await comments.find(eventId, comment.parentId);
        if (!parent || !this.canReadComment(parent, blockedIds)) {
          throw new AppError('Comment not found', 404);
        }
      }
      return change(comments, comment, event);
    });
  }

  private async openDiscussion(user: AuthUser, eventId: string, tx: TransactionContext) {
    const events = this.events.inTransaction(tx);
    const event = await events.lockEvent(eventId);
    if (!event || this.access.isBlocked(user)) throw new AppError('Discussion not found', 404);
    const now = this.clock();
    const blockedIds = await this.visibleDiscussion(event, user, now, tx);
    return { event, now, blockedIds };
  }

  private async visibleDiscussion(
    event: Event,
    user: AuthUser | null,
    now: Date,
    tx?: TransactionContext
  ): Promise<string[]> {
    if (
      (event.status !== 'PUBLISHED' && event.status !== 'FULL') ||
      !event.firstEndsAt ||
      event.firstEndsAt <= now
    ) {
      throw new AppError('Discussion not found', 404);
    }
    const blockerIds = user ? await this.blocks.listBlockerIds(user.id, tx) : [];
    if (
      user?.id !== event.organizerId &&
      !(user && this.access.canAccessAdmin(user, 'ADMIN')) &&
      (event.isHiddenByAdmin ||
        blockerIds.includes(event.organizerId) ||
        !this.access.canViewEvent(user, event.ageRestriction, now))
    ) {
      throw new AppError('Discussion not found', 404);
    }
    return user ? this.blocks.listBlockedIds(user.id, tx) : [];
  }

  private isCompleted(event: Event, now: Date): boolean {
    return (
      event.status === 'COMPLETED' ||
      ((event.status === 'PUBLISHED' || event.status === 'FULL') &&
        event.firstEndsAt !== null &&
        event.firstEndsAt <= now)
    );
  }

  private canReadComment(comment: DiscussionComment, blockedIds: string[]): boolean {
    return (
      !comment.isArchived && !comment.isHiddenByAdmin && !blockedIds.includes(comment.authorId)
    );
  }

  private async author(id: string) {
    const profile = await this.profiles.findByUserId(id);
    return { id, name: profile?.name ?? null, avatarUrl: profile?.avatarUrl ?? null };
  }
}
