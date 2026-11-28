import type { RequestHandler } from 'express';
import { Router } from 'express';
import { validate } from '../../../../middlewares/index.js';
import { createRequestRateLimit } from '../../../../middlewares/request-rate-limit.js';
import type { GeolocationController } from './geolocation.controller.js';
import {
  createLocationSchema,
  getLocationParamsSchema,
  getLocationQuerySchema,
  searchNearbyQuerySchema,
  searchBBoxQuerySchema,
  geocodeAddressSchema,
  reverseGeocodeSchema
} from './geolocation.schema.js';

export function createGeolocationRouter(
  controller: GeolocationController,
  requireAuth: RequestHandler
): Router {
  const router = Router();
  const geocodeLimit = createRequestRateLimit({ limit: 30, windowMs: 60_000 });

  router.post(
    '/locations',
    requireAuth,
    validate({ body: createLocationSchema }),
    controller.create
  );

  router.get('/locations/nearby', validate({ query: searchNearbyQuerySchema }), controller.nearby);

  router.get('/locations/bbox', validate({ query: searchBBoxQuerySchema }), controller.inBBox);

  router.get(
    '/locations/:id',
    validate({ params: getLocationParamsSchema, query: getLocationQuerySchema }),
    (req, res, next) => (req.query.precision === 'EXACT' ? requireAuth(req, res, next) : next()),
    controller.getById
  );

  router.post(
    '/geocode',
    geocodeLimit,
    validate({ body: geocodeAddressSchema }),
    controller.geocode
  );

  router.post(
    '/reverse-geocode',
    geocodeLimit,
    validate({ body: reverseGeocodeSchema }),
    controller.reverse
  );

  return router;
}
