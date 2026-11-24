import type { Request, Response } from 'express';
import type {
  CreateEventUseCase,
  GetEventsUseCase,
  GetEventByIdUseCase
} from '../../application/index.js';
import type { CreateEventSchema } from './create-event.schema.js';
import { toEventContext } from './event-context.js';
import { toEventView, toPublicEventView } from './event.view.js';
import type { GetEventsQuery } from '../../application/index.js';

interface EventsControllerDependencies {
  createEvent: CreateEventUseCase;
  getEvents: GetEventsUseCase;
  getEventById: GetEventByIdUseCase;
}

export function createEventsController({
  createEvent,
  getEvents,
  getEventById
}: EventsControllerDependencies) {
  return {
    async create(req: Request, res: Response): Promise<void> {
      const body = req.body as CreateEventSchema;

      const event = await createEvent.execute(toEventContext(req), body);

      res.status(201).json({ data: toEventView(event) });
    },

    async getAll(req: Request, res: Response): Promise<void> {
      const query = req.query as unknown as GetEventsQuery;
      const result = await getEvents.execute(query, req.user ?? null);

      res.status(200).json({
        data: result.items.map(toPublicEventView),
        pagination: {
          nextCursor: result.nextCursor,
          hasMore: result.nextCursor !== null
        }
      });
    },

    async getById(req: Request, res: Response): Promise<void> {
      const { id } = req.params as { id: string };
      const event = await getEventById.execute(id, req.user ?? null);

      res.status(200).json({
        data: toPublicEventView(event)
      });
    }
  };
}

export type EventsController = ReturnType<typeof createEventsController>;
