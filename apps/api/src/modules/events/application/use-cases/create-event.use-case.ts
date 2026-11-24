import { AppError } from '../../../../common/index.js';
import type { AccessService } from '../../../users/index.js';
import type { EventRepository } from '../ports/event.repository.js';
import type { CreateEventData } from '../types/create-event-data.js';
import type { EventContext } from '../types/event-context.js';
import type { Event } from '../../domain/index.js';
import { validateCreateEvent } from '../../domain/index.js';

export class CreateEventUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly access: AccessService
  ) {}

  async execute(context: EventContext, data: CreateEventData): Promise<Event> {
    if (!this.access.canCreateEventWithRestriction(context.user, data.ageRestriction)) {
      throw new AppError('Event creation is not allowed for this account', 403);
    }

    validateCreateEvent(data);

    return this.eventRepository.create(context.user.id, data);
  }
}
