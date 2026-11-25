import { AppError } from '../../../../common/index.js';
import type { AccessService, AuthUser } from '../../../users/index.js';
import type { EventRepository } from '../ports/event.repository.js';
import type { Event } from '../../domain/index.js';

import type { ManageEventUseCase } from './manage-event.use-case.js';

export class GetEventByIdUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly access: AccessService,
    private readonly manageEvent: ManageEventUseCase
  ) {}

  async execute(id: string, user: AuthUser | null): Promise<Event> {
    const draft = user ? await this.manageEvent.getDraft(user, id) : null;
    if (draft) return draft;

    const event = await this.eventRepository.findPublishedById(id);

    if (!event || !this.access.canViewEvent(user, event.ageRestriction))
      throw new AppError('Event not found', 404);

    return event;
  }
}
