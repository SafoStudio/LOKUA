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

import type { ManageEventUseCase } from '../../application/use-cases/manage-event.use-case.js';
import type { CancelEventBody, UpdateEventBody } from './manage-event.schema.js';

function eventId(req: Request): string {
  return (req.params as { id: string }).id;
}

interface EventsControllerDependencies {
  manageEvent: ManageEventUseCase;
  createEvent: CreateEventUseCase;
  getEvents: GetEventsUseCase;
  getEventById: GetEventByIdUseCase;
}

export function createEventsController({
  manageEvent,
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

    async update(req: Request, res: Response): Promise<void> {
      const event = await manageEvent.update(
        toEventContext(req).user,
        eventId(req),
        req.body as UpdateEventBody
      );
      res.status(200).json({ data: toEventView(event) });
    },

    async publish(req: Request, res: Response): Promise<void> {
      const event = await manageEvent.publish(toEventContext(req).user, eventId(req));
      res.status(200).json({ data: toEventView(event) });
    },

    async cancel(req: Request, res: Response): Promise<void> {
      const { reason } = req.body as CancelEventBody;
      const event = await manageEvent.cancel(toEventContext(req).user, eventId(req), reason);
      res.status(200).json({ data: toEventView(event) });
    },

    async remove(req: Request, res: Response): Promise<void> {
      await manageEvent.delete(toEventContext(req).user, eventId(req));
      res.status(204).end();
    },

    async duplicate(req: Request, res: Response): Promise<void> {
      const event = await manageEvent.duplicate(toEventContext(req).user, eventId(req));
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
      res.set('Cache-Control', 'private, no-store');

      res.status(200).json({
        data: event.status === 'DRAFT' ? toEventView(event) : toPublicEventView(event)
      });
    }
  };
}

export type EventsController = ReturnType<typeof createEventsController>;
