import type { Request, Response } from 'express';
import type {
  CreateEventUseCase,
  GetEventsUseCase,
  GetEventByIdUseCase
} from '../../application/index.js';
import type { CreateEventSchema } from './create-event.schema.js';
import { toEventContext } from './event-context.js';
import { toEventView, toFeedEventView, toMapEventView, toPublicEventView } from './event.view.js';
import type { GetEventsQuery } from '../../application/index.js';

import type { ManageParticipationUseCase } from '../../application/use-cases/manage-participation.use-case.js';
import type {
  ListEventParticipationUseCase,
  ParticipationPageQuery
} from '../../application/use-cases/list-event-participation.use-case.js';
import type {
  ParticipationBody,
  ParticipationParams,
  ParticipationReason
} from './participation.schema.js';
import { toOwnParticipationView } from './participation.view.js';
import type { ManageEventUseCase } from '../../application/use-cases/manage-event.use-case.js';
import type { CancelEventBody, UpdateEventBody } from './manage-event.schema.js';

function eventId(req: Request): string {
  return (req.params as { id: string }).id;
}

interface EventsControllerDependencies {
  manageParticipation: ManageParticipationUseCase;
  listParticipation: ListEventParticipationUseCase;
  manageEvent: ManageEventUseCase;
  createEvent: CreateEventUseCase;
  getEvents: GetEventsUseCase;
  getEventById: GetEventByIdUseCase;
}

export function createEventsController({
  listParticipation,
  manageParticipation,
  manageEvent,
  createEvent,
  getEvents,
  getEventById
}: EventsControllerDependencies) {
  const getPage =
    (view: typeof toFeedEventView | typeof toMapEventView) =>
    async (req: Request, res: Response): Promise<void> => {
      const query = req.query as unknown as GetEventsQuery;
      const result = await getEvents.execute(query, req.user ?? null);
      res.set('Cache-Control', 'private, no-store');

      res.status(200).json({
        data: result.items.map((event) => view(event)),
        pagination: {
          nextCursor: result.nextCursor,
          hasMore: result.nextCursor !== null
        }
      });
    };

  const decide =
    (decision: 'APPROVED' | 'REJECTED') =>
    async (req: Request, res: Response): Promise<void> => {
      const { id, participationId } = req.params as ParticipationParams;
      const reason = (req.body as ParticipationReason | undefined)?.reason;
      const participation = await manageParticipation.decide(
        toEventContext(req).user,
        id,
        participationId,
        decision,
        reason
      );
      res.status(200).json({ data: toOwnParticipationView(participation) });
    };

  const list =
    (kind: 'APPLICATIONS' | 'PARTICIPANTS') =>
    async (req: Request, res: Response): Promise<void> => {
      const query = req.query as unknown as ParticipationPageQuery;
      const result = await listParticipation.execute(
        toEventContext(req).user,
        eventId(req),
        kind,
        query
      );
      res.set('Cache-Control', 'private, no-store');
      res.status(200).json({
        data: result.items.map(({ participation, profile }) => ({
          ...toOwnParticipationView(participation),
          user: profile,
          applicationMessage:
            kind === 'APPLICATIONS' ? (participation.applicationMessage ?? null) : undefined
        })),
        organizer: result.organizer ?? undefined,
        pagination: { nextCursor: result.nextCursor, hasMore: result.nextCursor !== null }
      });
    };

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

    async join(req: Request, res: Response): Promise<void> {
      const { message } = req.body as ParticipationBody;
      const result = await manageParticipation.join(
        toEventContext(req).user,
        eventId(req),
        message
      );
      res.status(200).json({
        data: {
          participation: toOwnParticipationView(result.participation),
          warnings: result.warnings
        }
      });
    },

    async cancelParticipation(req: Request, res: Response): Promise<void> {
      const participation = await manageParticipation.cancel(
        toEventContext(req).user,
        eventId(req)
      );
      res.status(200).json({ data: toOwnParticipationView(participation) });
    },

    approveApplication: decide('APPROVED'),
    rejectApplication: decide('REJECTED'),
    listApplications: list('APPLICATIONS'),
    listParticipants: list('PARTICIPANTS'),

    async removeParticipant(req: Request, res: Response): Promise<void> {
      const { id, participationId } = req.params as ParticipationParams;
      const { reason } = req.body as ParticipationReason;
      const participation = await manageParticipation.remove(
        toEventContext(req).user,
        id,
        participationId,
        reason
      );
      res.status(200).json({ data: toOwnParticipationView(participation) });
    },

    getAll: getPage(toFeedEventView),
    getMap: getPage(toMapEventView),

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
