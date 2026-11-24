import type { EventRepository } from '../ports/event.repository.js';
import type { GetEventsQuery } from '../types/get-events-query.js';

export class GetEventsUseCase {
  constructor(private readonly eventRepository: EventRepository) {}

  execute(query: GetEventsQuery) {
    return this.eventRepository.findPublished(query);
  }
}
