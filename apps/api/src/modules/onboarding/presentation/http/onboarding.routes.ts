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
import type { createOnboardingController } from './onboarding.controller.js';

interface OnboardingRouterDependencies {
  requireAuth: RequestHandler;
  controller: ReturnType<typeof createOnboardingController>;
}

export function createOnboardingRouter({ requireAuth, controller }: OnboardingRouterDependencies) {
  const router = Router();

  router.get('/state', requireAuth, controller.getState);

  router.post(
    '/date-of-birth',
    requireAuth,
    requireOnboardingInProgress,
    validate({ body: dateOfBirthSchema }),
    controller.applyDateOfBirth
  );

  router.post(
    '/profile',
    requireAuth,
    requireOnboardingInProgress,
    validate({ body: profileSchema }),
    controller.applyProfile
  );

  router.post(
    '/city',
    requireAuth,
    requireOnboardingInProgress,
    validate({ body: citySchema }),
    controller.applyCity
  );

  router.post(
    '/interests',
    requireAuth,
    requireOnboardingInProgress,
    validate({ body: interestsSchema }),
    controller.applyInterests
  );

  router.post(
    '/optional',
    requireAuth,
    requireOnboardingInProgress,
    validate({ body: optionalProfileSchema }),
    controller.applyOptionalProfile
  );

  router.post('/complete', requireAuth, controller.complete);

  return router;
}
