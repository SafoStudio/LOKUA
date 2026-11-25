import { Router } from 'express';
import type { RequestHandler } from 'express';
import { validate } from '../../../../middlewares/index.js';
import { createEventSchema } from './create-event.schema.js';
import type { EventsController } from './events.controller.js';
import {
  getEventsQuerySchema,
  getEventsMapQuerySchema,
  getEventByIdParamsSchema
} from './get-events.schema.js';

import { cancelEventSchema, updateEventSchema } from './manage-event.schema.js';

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
  router.get('/map', optionalAuth, validate({ query: getEventsMapQuerySchema }), controller.getMap);

  router.get(
    '/:id',
    optionalAuth,
    validate({ params: getEventByIdParamsSchema }),
    controller.getById
  );

  router.post('/', requireAuth, validate({ body: createEventSchema }), controller.create);

  const validateId = validate({ params: getEventByIdParamsSchema });
  router.patch(
    '/:id',
    requireAuth,
    validate({ params: getEventByIdParamsSchema, body: updateEventSchema }),
    controller.update
  );
  router.post('/:id/participations', requireAuth, validateId, controller.join);
  router.delete('/:id/participations/me', requireAuth, validateId, controller.cancelParticipation);
  router.post('/:id/publish', requireAuth, validateId, controller.publish);
  router.post(
    '/:id/cancel',
    requireAuth,
    validate({ params: getEventByIdParamsSchema, body: cancelEventSchema }),
    controller.cancel
  );
  router.delete('/:id', requireAuth, validateId, controller.remove);
  router.post('/:id/duplicate', requireAuth, validateId, controller.duplicate);

  return router;
}
