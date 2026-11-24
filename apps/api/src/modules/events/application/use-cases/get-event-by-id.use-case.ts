import { AppError } from '../../../../common/index.js';
import type { AccessService, AuthUser } from '../../../users/index.js';
import type { EventRepository } from '../ports/event.repository.js';
import type { Event } from '../../domain/index.js';

export class GetEventByIdUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly access: AccessService
  ) {}

  async execute(id: string, user: AuthUser | null): Promise<Event> {
    const event = await this.eventRepository.findPublishedById(id);

    if (!event || !this.access.canViewEvent(user, event.ageRestriction))
      throw new AppError('Event not found', 404);

    return event;
  }
}
