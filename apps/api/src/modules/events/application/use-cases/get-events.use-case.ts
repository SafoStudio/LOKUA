import type { AccessService, AuthUser } from '../../../users/index.js';
import type { AgeRestriction } from '../../domain/index.js';
import type { EventRepository } from '../ports/event.repository.js';
import type { GetEventsQuery } from '../types/get-events-query.js';

export class GetEventsUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly access: AccessService
  ) {}

  execute(query: GetEventsQuery, user: AuthUser | null) {
    const restrictions: AgeRestriction[] = ['ALL', 'SIXTEEN_PLUS', 'EIGHTEEN_PLUS'];
    return this.eventRepository.findPublished({
      ...query,
      ageRestrictions: restrictions.filter((restriction) =>
        this.access.canViewEvent(user, restriction)
      )
    });
  }
}
