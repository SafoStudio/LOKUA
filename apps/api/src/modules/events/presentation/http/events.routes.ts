import { Router } from 'express';
import type { RequestHandler } from 'express';
import { validate } from '../../../../middlewares/index.js';
import { createEventSchema } from './create-event.schema.js';
import type { EventsController } from './events.controller.js';
import type { DiscussionController } from './discussion.controller.js';
import type { EventReviewController } from './event-review.controller.js';
import {
  createReviewSchema,
  editReviewSchema,
  pinReviewSchema,
  replyToReviewSchema,
  reviewPageSchema,
  reviewParamsSchema
} from './event-review.schema.js';
import {
  commentParamsSchema,
  createCommentSchema,
  discussionQuerySchema,
  editCommentSchema
} from './discussion.schema.js';
import { myEventsQuerySchema } from './my-events.schema.js';
import {
  getEventsQuerySchema,
  getEventsMapQuerySchema,
  getEventByIdParamsSchema
} from './get-events.schema.js';

import { cancelEventSchema, updateEventSchema } from './manage-event.schema.js';

import {
  participationBodySchema,
  participationPageSchema,
  participationParamsSchema,
  participationReasonSchema,
  rejectApplicationBodySchema
} from './participation.schema.js';

interface EventsRouterDependencies {
  requireAuth: RequestHandler;
  optionalAuth: RequestHandler;
  controller: EventsController;
  discussion: DiscussionController;
  reviews: EventReviewController;
}

export function createEventsRouter({
  requireAuth,
  optionalAuth,
  controller,
  discussion,
  reviews
}: EventsRouterDependencies) {
  const router = Router();

  router.get('/', optionalAuth, validate({ query: getEventsQuerySchema }), controller.getAll);
  router.get('/map', optionalAuth, validate({ query: getEventsMapQuerySchema }), controller.getMap);
  router.get('/me', requireAuth, validate({ query: myEventsQuerySchema }), controller.getMine);

  router.get(
    '/:id',
    optionalAuth,
    validate({ params: getEventByIdParamsSchema }),
    controller.getById
  );

  router.post('/', requireAuth, validate({ body: createEventSchema }), controller.create);

  const validateId = validate({ params: getEventByIdParamsSchema });
  router.get(
    '/:id/reviews',
    optionalAuth,
    validate({ params: getEventByIdParamsSchema, query: reviewPageSchema }),
    reviews.listForEvent
  );
  router.post(
    '/:id/reviews',
    requireAuth,
    validate({ params: getEventByIdParamsSchema, body: createReviewSchema }),
    reviews.create
  );
  router.post(
    '/:id/reviews/:reviewId/reply',
    requireAuth,
    validate({ params: reviewParamsSchema, body: replyToReviewSchema }),
    reviews.reply
  );
  router.patch(
    '/:id/reviews/:reviewId',
    requireAuth,
    validate({ params: reviewParamsSchema, body: editReviewSchema }),
    reviews.edit
  );
  router.put(
    '/:id/reviews/:reviewId/pin',
    requireAuth,
    validate({ params: reviewParamsSchema, body: pinReviewSchema }),
    reviews.pin
  );
  router.get(
    '/:id/comments',
    optionalAuth,
    validate({ params: getEventByIdParamsSchema, query: discussionQuerySchema }),
    discussion.list
  );
  router.post(
    '/:id/comments',
    requireAuth,
    validate({ params: getEventByIdParamsSchema, body: createCommentSchema }),
    discussion.create
  );
  router.patch(
    '/:id/comments/:commentId',
    requireAuth,
    validate({ params: commentParamsSchema, body: editCommentSchema }),
    discussion.edit
  );
  router.delete(
    '/:id/comments/:commentId',
    requireAuth,
    validate({ params: commentParamsSchema }),
    discussion.remove
  );
  router.patch(
    '/:id',
    requireAuth,
    validate({ params: getEventByIdParamsSchema, body: updateEventSchema }),
    controller.update
  );
  router.post(
    '/:id/participations',
    requireAuth,
    validate({ params: getEventByIdParamsSchema, body: participationBodySchema }),
    controller.join
  );
  const validatePage = validate({
    params: getEventByIdParamsSchema,
    query: participationPageSchema
  });
  const validateParticipation = validate({ params: participationParamsSchema });
  const validateReason = validate({
    params: participationParamsSchema,
    body: participationReasonSchema
  });
  router.get('/:id/applications', requireAuth, validatePage, controller.listApplications);
  router.post(
    '/:id/applications/:participationId/approve',
    requireAuth,
    validateParticipation,
    controller.approveApplication
  );
  router.post(
    '/:id/applications/:participationId/reject',
    requireAuth,
    validate({ params: participationParamsSchema, body: rejectApplicationBodySchema }),
    controller.rejectApplication
  );
  router.get('/:id/participants', requireAuth, validatePage, controller.listParticipants);
  router.delete(
    '/:id/participants/:participationId',
    requireAuth,
    validateReason,
    controller.removeParticipant
  );
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
