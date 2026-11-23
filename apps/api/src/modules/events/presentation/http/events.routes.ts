import { Router } from 'express';
import type { RequestHandler } from 'express';
import { validate } from '../../../../middlewares/index.js';
import { createEventSchema } from './create-event.schema.js';
import type { EventsController } from './events.controller.js';

interface EventsRouterDependencies {
  requireAuth: RequestHandler;
  controller: EventsController;
}

export function createEventsRouter({ requireAuth, controller }: EventsRouterDependencies) {
  const router = Router();

  router.post('/', requireAuth, validate({ body: createEventSchema }), controller.create);

  return router;
}
