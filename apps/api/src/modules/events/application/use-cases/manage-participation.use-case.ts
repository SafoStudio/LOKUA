import { AppError } from '../../../../common/index.js';
import type { TransactionContext, UnitOfWork } from '../../../../common/index.js';
import type {
  AccessService,
  AuthUser,
  AuthUserProvider,
  UserBlockProvider
} from '../../../users/index.js';
import type { EventParticipation } from '../../domain/models/event-participation.js';
import type { Event } from '../../domain/index.js';
import type { EventParticipationRepository } from '../ports/event-participation.repository.js';
import type { NotificationPublisher } from '../../../notifications/index.js';
import { publishEventNotification } from '../publish-event-notification.js';

export class ManageParticipationUseCase {
  constructor(
    private readonly repository: EventParticipationRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly users: AuthUserProvider,
    private readonly access: AccessService,
    private readonly blocks: UserBlockProvider,
    private readonly clock: () => Date,
    private readonly notifications?: NotificationPublisher
  ) {}

  join(user: AuthUser, eventId: string, message?: string) {
    return this.withEvent(eventId, async (events, event, now, tx) => {
      if (
        event.isHiddenByAdmin ||
        !this.access.canViewEvent(user, event.ageRestriction, now) ||
        (await this.blocks.listRelatedUserIds(user.id, tx)).includes(event.organizerId)
      ) {
        throw new AppError('Event not found', 404);
      }
      if (!this.access.canJoinEvent(user, event.ageRestriction, now)) {
        throw new AppError('Event participation is not allowed for this account', 403);
      }
      this.ensureOpen(event, now);
      if (event.organizerId === user.id) {
        throw new AppError('The organizer already participates in the event', 409);
      }
      const mode = event.participationMode;
      if (mode === 'FREE' && message !== undefined) {
        throw new AppError('Application messages require participation mode REQUEST', 409);
      }
      const applicationMessage = this.normalizeText(message);
      let participation = await events.findParticipation(event.id, user.id);
      if (
        participation &&
        participation.status !== 'APPROVED' &&
        participation.status !== 'PENDING'
      ) {
        throw new AppError('This participation cannot be reopened', 409);
      }
      if (!participation) {
        const entry = {
          eventId: event.id,
          userId: user.id,
          statusUpdatedAt: now
        };
        participation =
          mode === 'REQUEST'
            ? await events.saveParticipation({ ...entry, status: 'PENDING', applicationMessage })
            : await this.approve(events, event, entry);
        await publishEventNotification(
          this.notifications,
          tx,
          event,
          mode === 'REQUEST' ? 'NEW_APPLICATION' : 'FREE_PARTICIPATION',
          [event.organizerId]
        );
      }

      const conflict = await events.hasScheduleConflict(
        user.id,
        event.id,
        event.firstStartsAt,
        event.firstEndsAt
      );
      return { participation, warnings: conflict ? (['SCHEDULE_CONFLICT'] as const) : [] };
    });
  }

  cancel(user: AuthUser, eventId: string) {
    return this.withEvent(eventId, async (events, event, now, tx) => {
      if (event.organizerId === user.id) {
        throw new AppError('The organizer cannot cancel their own participation', 409);
      }
      const participation = await events.findParticipation(event.id, user.id);
      if (!participation) throw new AppError('Participation not found', 404);
      if (participation.status === 'CANCELLED_BY_USER') return participation;

      this.ensureOpen(event, now);
      if (participation.status !== 'APPROVED' && participation.status !== 'PENDING') {
        throw new AppError('This participation cannot be cancelled', 409);
      }
      const saved = await events.saveParticipation({
        ...participation,
        status: 'CANCELLED_BY_USER',
        statusUpdatedAt: now
      });
      if (participation.status === 'APPROVED') {
        await this.updateCapacity(events, event, await events.countApproved(event));
      }
      await publishEventNotification(this.notifications, tx, event, 'PARTICIPATION_CANCELLED', [
        event.organizerId
      ]);
      return saved;
    });
  }

  decide(
    user: AuthUser,
    eventId: string,
    participationId: string,
    decision: 'APPROVED' | 'REJECTED'
  ) {
    return this.withEvent(eventId, async (events, event, now, tx) => {
      this.ensureOwner(event, user);
      const participation = await this.findManagedParticipation(events, event, participationId);
      if (participation.status === decision) return participation;

      this.ensureOpen(event, now);
      if (participation.status !== 'PENDING') {
        throw new AppError('The application is no longer pending', 409);
      }
      if (decision === 'REJECTED') {
        const saved = await events.saveParticipation({
          ...participation,
          status: decision,
          statusUpdatedAt: now,
          removalReason: null
        });
        await publishEventNotification(this.notifications, tx, event, 'APPLICATION_REJECTED', [
          saved.userId
        ]);
        return saved;
      }

      const applicant = await this.users.findById(participation.userId, tx);
      if (
        event.isHiddenByAdmin ||
        !applicant ||
        !this.access.canJoinEvent(applicant, event.ageRestriction, now) ||
        (await this.blocks.listRelatedUserIds(applicant.id, tx)).includes(event.organizerId)
      ) {
        throw new AppError('The applicant is no longer eligible to join', 409);
      }
      const approved = await this.approve(events, event, {
        ...participation,
        statusUpdatedAt: now
      });
      await publishEventNotification(this.notifications, tx, event, 'APPLICATION_APPROVED', [
        approved.userId
      ]);
      return approved;
    });
  }

  remove(user: AuthUser, eventId: string, participationId: string, reason?: string) {
    return this.withEvent(eventId, async (events, event, now, tx) => {
      this.ensureOwner(event, user);
      const participation = await this.findManagedParticipation(events, event, participationId);
      if (participation.status === 'REMOVED_BY_ORGANIZER') return participation;

      this.ensureOpen(event, now);
      if (participation.status !== 'APPROVED') {
        throw new AppError('Only approved participants can be removed', 409);
      }
      const saved = await events.saveParticipation({
        ...participation,
        status: 'REMOVED_BY_ORGANIZER',
        statusUpdatedAt: now,
        removalReason: this.normalizeText(reason)
      });
      await this.updateCapacity(events, event, await events.countApproved(event));
      await publishEventNotification(
        this.notifications,
        tx,
        event,
        'PARTICIPANT_REMOVED',
        [saved.userId],
        saved.removalReason
      );
      return saved;
    });
  }

  private async approve(
    events: EventParticipationRepository,
    event: Event,
    entry: Pick<EventParticipation, 'eventId' | 'userId' | 'statusUpdatedAt'> & { id?: string }
  ): Promise<EventParticipation> {
    const approved = await events.countApproved(event);
    if (event.capacityLimit !== null && approved >= event.capacityLimit) {
      throw new AppError('The event has no available places', 409);
    }
    const participation = await events.saveParticipation({ ...entry, status: 'APPROVED' });
    await this.updateCapacity(events, event, approved + 1);
    return participation;
  }

  private ensureOwner(event: Event, user: AuthUser): void {
    if (event.organizerId !== user.id) throw new AppError('Event not found', 404);
  }

  private async findManagedParticipation(
    events: EventParticipationRepository,
    event: Event,
    id: string
  ): Promise<EventParticipation> {
    const participation = await events.findParticipationById(event.id, id);
    if (!participation || participation.userId === event.organizerId) {
      throw new AppError('Participation not found', 404);
    }
    return participation;
  }

  private normalizeText(value?: string): string | null {
    const text = value?.trim() || null;
    if (text && text.length > 300)
      throw new AppError('Participation text exceeds 300 characters', 422);
    return text;
  }

  private ensureOpen(
    event: Event,
    now: Date
  ): asserts event is Event & { firstStartsAt: Date; firstEndsAt: Date } {
    if (
      (event.status !== 'PUBLISHED' && event.status !== 'FULL') ||
      !event.firstStartsAt ||
      !event.firstEndsAt ||
      event.firstStartsAt <= now
    ) {
      throw new AppError('The event is closed for participation changes', 409);
    }
  }

  private async updateCapacity(
    events: EventParticipationRepository,
    event: Event,
    approved: number
  ): Promise<void> {
    const status =
      event.capacityLimit !== null && approved >= event.capacityLimit ? 'FULL' : 'PUBLISHED';
    if (status === event.status && event.hasApprovedParticipants) return;

    const saved = await events.save({ ...event, status, hasApprovedParticipants: true });
    if (status !== event.status) await events.syncSchedule(saved, event.firstStartsAt);
  }

  private withEvent<T>(
    id: string,
    run: (
      events: EventParticipationRepository,
      event: Event,
      now: Date,
      tx: TransactionContext
    ) => Promise<T>
  ): Promise<T> {
    return this.unitOfWork.run(async (tx) => {
      const events = this.repository.inTransaction(tx);
      const event = await events.lockEvent(id);
      if (!event || event.status === 'DRAFT') throw new AppError('Event not found', 404);
      return run(events, event, this.clock(), tx);
    });
  }
}
