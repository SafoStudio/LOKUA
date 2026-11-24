import { Router } from 'express';
import type { RequestHandler } from 'express';
import { validate } from '../../../../middlewares/index.js';
import { createEventSchema } from './create-event.schema.js';
import type { EventsController } from './events.controller.js';
import { getEventsQuerySchema, getEventByIdParamsSchema } from './get-events.schema.js';

interface EventsRouterDependencies {
  requireAuth: RequestHandler;
  optionalAuth: RequestHandler;
  controller: EventsController;
}

export function createEventsRouter({
  requireAuth,
  optionalAuth,
  controller
}: EventsRouterDependencies) {
  const router = Router();

  router.get('/', optionalAuth, validate({ query: getEventsQuerySchema }), controller.getAll);

  router.get(
    '/:id',
    optionalAuth,
    validate({ params: getEventByIdParamsSchema }),
    controller.getById
  );

  router.post('/', requireAuth, validate({ body: createEventSchema }), controller.create);

  return router;
}
