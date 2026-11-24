import { AppError } from '../../../../common/index.js';
import type { EventRepository } from '../ports/event.repository.js';
import type { Event } from '../../domain/index.js';

export class GetEventByIdUseCase {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(id: string): Promise<Event> {
    const event = await this.eventRepository.findPublishedById(id);

    if (!event) throw new AppError('Event not found', 404);

    return event;
  }
}
