import { AppError } from '../../../../common/index.js';
import type { TransactionContext, UnitOfWork } from '../../../../common/index.js';
import type { AccessService, AuthUser, UserBlockProvider } from '../../../users/index.js';
import type { Event } from '../../domain/index.js';
import type { EventParticipationRepository } from '../ports/event-participation.repository.js';

export class ManageParticipationUseCase {
  constructor(
    private readonly repository: EventParticipationRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly access: AccessService,
    private readonly blocks: UserBlockProvider,
    private readonly clock: () => Date
  ) {}

  join(user: AuthUser, eventId: string) {
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
      if (event.participationMode !== 'FREE') {
        throw new AppError('The event requires an application', 409);
      }

      let participation = await events.findParticipation(event.id, user.id);
      if (participation && participation.status !== 'APPROVED') {
        throw new AppError('This participation cannot be reopened', 409);
      }
      if (!participation) {
        const approved = await events.countApproved(event);
        if (event.capacityLimit !== null && approved >= event.capacityLimit) {
          throw new AppError('The event has no available places', 409);
        }
        participation = await events.saveParticipation({
          eventId: event.id,
          userId: user.id,
          status: 'APPROVED',
          statusUpdatedAt: now
        });
        await this.updateCapacity(events, event, approved + 1);
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
    return this.withEvent(eventId, async (events, event, now) => {
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
      return saved;
    });
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
