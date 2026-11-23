import type { Request, Response } from 'express';
import type { CreateEventUseCase } from '../../application/index.js';
import type { CreateEventSchema } from './create-event.schema.js';
import { toEventContext } from './event-context.js';
import { toEventView } from './event.view.js';

interface EventsControllerDependencies {
  createEvent: CreateEventUseCase;
}

export function createEventsController({ createEvent }: EventsControllerDependencies) {
  return {
    async create(req: Request, res: Response): Promise<void> {
      const body = req.body as CreateEventSchema;

      const event = await createEvent.execute(toEventContext(req), body);

      res.status(201).json({ data: toEventView(event) });
    }
  };
}

export type EventsController = ReturnType<typeof createEventsController>;
