import { AppError } from '../../../../common/index.js';
import type { UserProvider } from '../../../users/index.js';
import type { EventRepository } from '../ports/event.repository.js';
import type { CreateEventData } from '../types/create-event-data.js';
import type { EventContext } from '../types/event-context.js';
import type { Event } from '../../domain/index.js';
import { validateCreateEvent } from '../../domain/index.js';

export class CreateEventUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly users: UserProvider
  ) {}

  async execute(context: EventContext, data: CreateEventData): Promise<Event> {
    const organizer = await this.users.findById(context.user.id);

    if (!organizer) throw new AppError('User not found', 404);

    validateCreateEvent(data, organizer.birthDate);

    return this.eventRepository.create(context.user.id, data);
  }
}
