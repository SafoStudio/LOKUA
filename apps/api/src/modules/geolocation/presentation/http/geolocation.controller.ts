import type { Request, Response } from 'express';
import { AppError } from '../../../../common/index.js';
import type {
  CreateLocationUseCase,
  FindPublicLocationByIdUseCase,
  SearchLocationsNearbyUseCase,
  SearchLocationsInBBoxUseCase,
  GeocodeAddressUseCase,
  ReverseGeocodeUseCase
} from '../../application/index.js';
import type { Location } from '../../domain/index.js';
import { LocationNotFoundError } from '../../domain/index.js';
import { toLocationView } from './location.view.js';
import { toGeocodeView } from './geocode.view.js';
import type { NearbyQuery, BBoxQuery } from './geolocation.schema.js';

interface GeolocationControllerDependencies {
  createLocation: CreateLocationUseCase;
  findExactById(id: string, viewerId: string): Promise<Location | null>;
  findPublicLocationById: FindPublicLocationByIdUseCase;
  searchNearby: SearchLocationsNearbyUseCase;
  searchInBBox: SearchLocationsInBBoxUseCase;
  geocodeAddress: GeocodeAddressUseCase;
  reverseGeocode: ReverseGeocodeUseCase;
}

export function createGeolocationController({
  createLocation,
  findExactById,
  findPublicLocationById,
  searchNearby,
  searchInBBox,
  geocodeAddress,
  reverseGeocode
}: GeolocationControllerDependencies) {
  return {
    async create(req: Request, res: Response): Promise<void> {
      if (!req.user) throw new AppError('Authentication required', 401);
      const location = await createLocation.execute({
        ...req.body,
        districtId: req.body.districtId ?? null,
        createdBy: req.user.id
      });
      res.set('Cache-Control', 'private, no-store');
      res.status(201).json({ data: toLocationView(location) });
    },

    async getById(req: Request, res: Response): Promise<void> {
      const precision = (req.query.precision as 'EXACT' | 'PUBLIC') ?? 'PUBLIC';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      res.set('Cache-Control', 'private, no-store');

      if (precision === 'EXACT') {
        if (!req.user) throw new AppError('Authentication required', 401);
        const location = await findExactById(id, req.user.id);
        if (!location) throw new LocationNotFoundError(id);
        res.status(200).json({ data: toLocationView(location) });
        return;
      }

      const location = await findPublicLocationById.execute({ id });
      res.status(200).json({ data: location });
    },

    async nearby(req: Request, res: Response): Promise<void> {
      const { latitude, longitude, radiusMeters, limit } = req.query as unknown as NearbyQuery;

      const results = await searchNearby.execute({
        coordinates: { latitude, longitude },
        radiusMeters,
        limit
      });

      res.status(200).json({ data: results });
    },

    async inBBox(req: Request, res: Response): Promise<void> {
      const results = await searchInBBox.execute(req.query as unknown as BBoxQuery);

      res.status(200).json({ data: results });
    },

    async geocode(req: Request, res: Response): Promise<void> {
      res.set('Cache-Control', 'private, no-store');
      const result = await geocodeAddress.execute(req.body);

      if (!result) throw new AppError('Address could not be geocoded', 404);

      res.status(200).json({ data: toGeocodeView(result) });
    },

    async reverse(req: Request, res: Response): Promise<void> {
      res.set('Cache-Control', 'private, no-store');
      const result = await reverseGeocode.execute(req.body);

      if (!result) throw new AppError('Coordinates could not be reverse-geocoded', 404);

      res.status(200).json({ data: toGeocodeView(result) });
    }
  };
}

export type GeolocationController = ReturnType<typeof createGeolocationController>;
