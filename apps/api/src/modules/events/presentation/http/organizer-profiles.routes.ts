import { Router } from 'express';
import type { RequestHandler } from 'express';
import { validate } from '../../../../middlewares/index.js';
import type { EventReviewController } from './event-review.controller.js';
import { organizerProfileParamsSchema, reviewPageSchema } from './event-review.schema.js';

export function createOrganizerProfilesRouter(
  optionalAuth: RequestHandler,
  reviews: EventReviewController
): Router {
  const router = Router();
  router.get(
    '/:id',
    optionalAuth,
    validate({ params: organizerProfileParamsSchema }),
    reviews.profile
  );
  router.get(
    '/:id/reviews',
    optionalAuth,
    validate({ params: organizerProfileParamsSchema, query: reviewPageSchema }),
    reviews.listForOrganizer
  );
  router.get(
    '/:id/events',
    optionalAuth,
    validate({ params: organizerProfileParamsSchema, query: reviewPageSchema }),
    reviews.listOrganizerHistory
  );
  return router;
}
