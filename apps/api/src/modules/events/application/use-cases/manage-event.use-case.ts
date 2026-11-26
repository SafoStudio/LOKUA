import { AppError } from '../../../../common/index.js';
import type { UnitOfWork } from '../../../../common/index.js';
import type { CategoryProvider } from '../../../dictionaries/index.js';
import type { LocationProvider } from '../../../geolocation/index.js';
import type { AccessService, AuthUser } from '../../../users/index.js';
import type { Event } from '../../domain/index.js';
import { validateCreateEvent } from '../../domain/index.js';
import {
  validateEventTags,
  validateEventTimezone,
  validatePublicationDates
} from '../../domain/rules/event-lifecycle.rules.js';
import type { EventManagementRepository } from '../ports/event-management.repository.js';
import type { CreateEventData } from '../types/create-event-data.js';

const ageOrder = ['ALL', 'SIXTEEN_PLUS', 'EIGHTEEN_PLUS'] as const;

export class ManageEventUseCase {
  constructor(
    private readonly events: EventManagementRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly access: AccessService,
    private readonly categories: CategoryProvider,
    private readonly locations: LocationProvider,
    private readonly clock: () => Date
  ) {}

  async getDraft(user: AuthUser, id: string): Promise<Event | null> {
    const event = await this.events.findOwned(id, user.id);
    if (event?.status !== 'DRAFT') return null;
    return { ...event, tags: await this.events.readTags(id) };
  }

  async create(user: AuthUser, data: CreateEventData): Promise<Event> {
    await this.validate(user, data);
    return this.unitOfWork.run(async (tx) => {
      const events = this.events.inTransaction(tx);
      await this.ensureLocationAvailable(events, user.id, data.primaryLocationId);
      const event = await events.create(user.id, data);
      const tags = validateEventTags(data.tags ?? []);
      await events.replaceTags(event.id, tags);
      return { ...event, tags };
    });
  }

  update(user: AuthUser, id: string, patch: Partial<CreateEventData>): Promise<Event> {
    return this.change(user, id, async (events, event, now) => {
      if (event.status !== 'DRAFT' && event.status !== 'PUBLISHED' && event.status !== 'FULL') {
        throw new AppError('Event cannot be edited in its current status', 409);
      }

      const next = { ...event, ...patch };
      const published = event.status !== 'DRAFT';
      if (patch.isFree && patch.priceText === undefined) next.priceText = null;
      const location = await this.validate(user, { ...next, mediaUrls: patch.mediaUrls });
      if (next.primaryLocationId !== event.primaryLocationId) {
        await this.ensureLocationAvailable(events, user.id, next.primaryLocationId);
      }

      if (published) {
        const startsChanged = next.firstStartsAt?.getTime() !== event.firstStartsAt?.getTime();
        if (startsChanged) {
          if (event.firstStartsAt && event.firstStartsAt <= now) {
            throw new AppError('A started event cannot be rescheduled', 409);
          }
          validatePublicationDates(next, now);
        }
        if (!next.firstStartsAt || !next.firstEndsAt || next.firstEndsAt <= now) {
          throw new AppError('A published event requires a schedule ending in the future', 422);
        }

        const restrictedEdit =
          next.format !== event.format ||
          ageOrder.indexOf(next.ageRestriction) > ageOrder.indexOf(event.ageRestriction);
        if (restrictedEdit && (await events.hasParticipantHistory(event))) {
          throw new AppError(
            'Event format or age restriction cannot change after participation',
            409
          );
        }

        const approved = await events.countApproved(event);
        if (next.capacityLimit !== null && next.capacityLimit < approved) {
          throw new AppError('Capacity cannot be below the approved participant count', 409);
        }
        if (next.firstStartsAt > now) {
          next.status =
            next.capacityLimit !== null && approved >= next.capacityLimit ? 'FULL' : 'PUBLISHED';
        }
      }

      const saved = await events.save(next);
      if (published) {
        await events.syncSchedule(saved, event.firstStartsAt);
        if (event.primaryLocationId !== next.primaryLocationId || event.format !== next.format) {
          await events.replaceSnapshot(id, location);
        }
      }
      if (patch.tags !== undefined) {
        await events.replaceTags(id, validateEventTags(patch.tags));
      }
      return { ...saved, tags: await events.readTags(id) };
    });
  }

  publish(user: AuthUser, id: string): Promise<Event> {
    return this.change(user, id, async (events, event, now) => {
      if (event.status !== 'DRAFT') throw new AppError('Only drafts can be published', 409);
      const location = await this.validate(user, event);
      await this.ensureLocationAvailable(events, user.id, event.primaryLocationId);
      validatePublicationDates(event, now);
      if ((await events.countUpcoming(user.id, now)) >= 10) {
        throw new AppError('Upcoming event limit reached', 409);
      }

      const saved = await events.save({ ...event, status: 'PUBLISHED', publishedAt: now });
      await events.syncSchedule(saved, event.firstStartsAt);
      await events.replaceSnapshot(id, location);
      return { ...saved, tags: await events.readTags(id) };
    });
  }

  cancel(user: AuthUser, id: string, reason: string): Promise<Event> {
    return this.change(user, id, async (events, event, now) => {
      if (
        (event.status !== 'PUBLISHED' && event.status !== 'FULL') ||
        (event.firstEndsAt && event.firstEndsAt <= now)
      ) {
        throw new AppError('Event cannot be cancelled in its current status', 409);
      }
      const cancellationReason = reason.trim();
      if (!cancellationReason || cancellationReason.length > 300) {
        throw new AppError('A cancellation reason of 1 to 300 characters is required', 422);
      }
      const saved = await events.save({ ...event, status: 'CANCELLED', cancellationReason });
      await events.syncSchedule(saved, event.firstStartsAt);
      return { ...saved, tags: await events.readTags(id) };
    });
  }

  delete(user: AuthUser, id: string): Promise<void> {
    return this.change(user, id, async (events, event, now) => {
      if (
        (event.status !== 'DRAFT' && event.status !== 'PUBLISHED') ||
        (event.status === 'PUBLISHED' && event.firstEndsAt && event.firstEndsAt <= now)
      ) {
        throw new AppError('Event cannot be deleted in its current status', 409);
      }
      if (await events.hasParticipantHistory(event)) {
        throw new AppError('Events with participant history cannot be deleted', 409);
      }
      if (await events.hasPendingApplications(id)) {
        throw new AppError('Events with pending applications cannot be deleted', 409);
      }
      await events.delete(id);
    });
  }

  duplicate(user: AuthUser, id: string): Promise<Event> {
    return this.change(user, id, async (events, event) => {
      const tags = validateEventTags(await events.readTags(id));
      const data = { ...event, firstStartsAt: null, firstEndsAt: null, tags };
      await this.validate(user, data);
      await this.ensureLocationAvailable(events, user.id, data.primaryLocationId);
      const draft = await events.create(user.id, data);
      await events.replaceTags(draft.id, tags);
      return { ...draft, tags };
    });
  }

  private change<T>(
    user: AuthUser,
    id: string,
    execute: (
      events: ReturnType<EventManagementRepository['inTransaction']>,
      event: Event,
      now: Date
    ) => Promise<T>
  ): Promise<T> {
    return this.unitOfWork.run(async (tx) => {
      const events = this.events.inTransaction(tx);
      await events.lockOrganizer(user.id);
      const event = await events.findOwned(id, user.id, true);
      if (!event) throw new AppError('Event not found', 404);
      return execute(events, event, this.clock());
    });
  }

  private async ensureLocationAvailable(
    events: EventManagementRepository,
    organizerId: string,
    locationId: string | null | undefined
  ): Promise<void> {
    if (locationId && (await events.hasForeignPrivateLocation(locationId, organizerId))) {
      throw new AppError('Event location not found', 422);
    }
  }

  private async validate(user: AuthUser, data: CreateEventData) {
    if (!this.access.canCreateEventWithRestriction(user, data.ageRestriction, this.clock())) {
      throw new AppError('Event management is not allowed for this account', 403);
    }
    validateCreateEvent(data);
    validateEventTimezone(data.timezone ?? 'Europe/Kyiv');
    validateEventTags(data.tags ?? []);
    if ((data.mediaUrls?.length ?? 0) > 5) {
      throw new AppError('An event can have at most five additional photos', 422);
    }
    if (!(await this.categories.findById(data.categoryId))) {
      throw new AppError('Event category not found', 422);
    }
    const location = data.primaryLocationId
      ? await this.locations.findById(data.primaryLocationId)
      : null;
    if (data.primaryLocationId && !location) throw new AppError('Event location not found', 422);
    return location;
  }
}
