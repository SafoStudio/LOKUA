import type { Event } from '../../domain/index.js';
import type { CreateEventData } from '../types/create-event-data.js';
import type { EventContext } from '../types/event-context.js';
import type { ManageEventUseCase } from './manage-event.use-case.js';

export class CreateEventUseCase {
  constructor(private readonly manageEvent: ManageEventUseCase) {}

  execute(context: EventContext, data: CreateEventData): Promise<Event> {
    return this.manageEvent.create(context.user, data);
  }
}
