import { Router } from 'express';
import type { RequestHandler } from 'express';
import { validate } from '../../../../middlewares/index.js';
import {
  dateOfBirthSchema,
  profileSchema,
  citySchema,
  interestsSchema,
  optionalProfileSchema
} from './onboarding.schema.js';
import { requireOnboardingInProgress } from './onboarding.middleware.js';
import type { OnboardingController } from './onboarding.controller.js';

interface OnboardingRouterDependencies {
  requireAuth: RequestHandler;
  controller: OnboardingController;
}

export function createOnboardingRouter({ requireAuth, controller }: OnboardingRouterDependencies) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  }, requireAuth);

  router.get('/state', controller.getState);

  router.post(
    '/date-of-birth',
    requireOnboardingInProgress,
    validate({ body: dateOfBirthSchema }),
    controller.applyDateOfBirth
  );

  router.post(
    '/profile',
    requireOnboardingInProgress,
    validate({ body: profileSchema }),
    controller.applyProfile
  );

  router.post(
    '/city',
    requireOnboardingInProgress,
    validate({ body: citySchema }),
    controller.applyCity
  );

  router.post(
    '/interests',
    requireOnboardingInProgress,
    validate({ body: interestsSchema }),
    controller.applyInterests
  );

  router.post(
    '/optional',
    requireOnboardingInProgress,
    validate({ body: optionalProfileSchema }),
    controller.applyOptionalProfile
  );

  router.post('/complete', controller.complete);

  return router;
}
