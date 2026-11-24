import type { Request, Response } from 'express';
import { AppError } from '../../../../common/index.js';
import type {
  CreateLocationUseCase,
  FindLocationByIdUseCase,
  FindPublicLocationByIdUseCase,
  SearchLocationsNearbyUseCase,
  SearchLocationsInBBoxUseCase,
  GeocodeAddressUseCase,
  ReverseGeocodeUseCase
} from '../../application/index.js';
import { toLocationView, toNearbyLocationItemView } from './location.view.js';
import { toGeocodeView } from './geocode.view.js';

interface GeolocationControllerDependencies {
  createLocation: CreateLocationUseCase;
  findLocationById: FindLocationByIdUseCase;
  findPublicLocationById: FindPublicLocationByIdUseCase;
  searchNearby: SearchLocationsNearbyUseCase;
  searchInBBox: SearchLocationsInBBoxUseCase;
  geocodeAddress: GeocodeAddressUseCase;
  reverseGeocode: ReverseGeocodeUseCase;
}

export function createGeolocationController({
  createLocation,
  findLocationById,
  findPublicLocationById,
  searchNearby,
  searchInBBox,
  geocodeAddress,
  reverseGeocode
}: GeolocationControllerDependencies) {
  return {
    async create(req: Request, res: Response): Promise<void> {
      if (!req.user) throw new AppError('Authentication required', 401);
      const location = await createLocation.execute({ ...req.body, createdBy: req.user.id });
      res.status(201).json({ data: toLocationView(location) });
    },

    async getById(req: Request, res: Response): Promise<void> {
      const precision = (req.query.precision as 'EXACT' | 'PUBLIC') ?? 'PUBLIC';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      if (precision === 'EXACT') {
        const location = await findLocationById.execute({ id });
        res.status(200).json({ data: toLocationView(location) });
        return;
      }

      const location = await findPublicLocationById.execute({ id });
      res.status(200).json({ data: location });
    },

    async nearby(req: Request, res: Response): Promise<void> {
      const { latitude, longitude, radiusMeters, limit } = req.query as {
        latitude: string;
        longitude: string;
        radiusMeters?: string;
        limit?: string;
      };

      const results = await searchNearby.execute({
        coordinates: {
          latitude: Number(latitude),
          longitude: Number(longitude)
        },
        radiusMeters: radiusMeters ? Number(radiusMeters) : undefined,
        limit: limit ? Number(limit) : undefined
      });

      res.status(200).json({ data: results.map(toNearbyLocationItemView) });
    },

    async inBBox(req: Request, res: Response): Promise<void> {
      const { minLat, minLng, maxLat, maxLng, limit } = req.query as {
        minLat: string;
        minLng: string;
        maxLat: string;
        maxLng: string;
        limit?: string;
      };

      const results = await searchInBBox.execute({
        minLat: Number(minLat),
        minLng: Number(minLng),
        maxLat: Number(maxLat),
        maxLng: Number(maxLng),
        limit: limit ? Number(limit) : undefined
      });

      res.status(200).json({ data: results });
    },

    async geocode(req: Request, res: Response): Promise<void> {
      const { address, city } = req.body;
      const result = await geocodeAddress.execute({ address, city });

      if (!result) throw new AppError('Address could not be geocoded', 404);

      res.status(200).json({ data: toGeocodeView(result) });
    },

    async reverse(req: Request, res: Response): Promise<void> {
      const { latitude, longitude } = req.body;
      const result = await reverseGeocode.execute({
        latitude: Number(latitude),
        longitude: Number(longitude)
      });

      if (!result) throw new AppError('Coordinates could not be reverse-geocoded', 404);

      res.status(200).json({ data: toGeocodeView(result) });
    }
  };
}

export type GeolocationController = ReturnType<typeof createGeolocationController>;
