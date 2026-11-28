import type { RequestHandler } from 'express';
import type { DataSource } from 'typeorm';
import type { CityProvider, CountryProvider } from '../dictionaries/index.js';
import type { UserProvider } from '../users/index.js';
import { env } from '../../config/env.js';
import { startBatchWorker } from '../../common/start-batch-worker.js';
import type {
  GeocodingProvider,
  ReverseGeocodingProvider,
  LocationProvider
} from './application/index.js';
import {
  CreateLocationUseCase,
  FindPublicLocationByIdUseCase,
  SearchLocationsNearbyUseCase,
  SearchLocationsInBBoxUseCase,
  GeocodeAddressUseCase,
  ReverseGeocodeUseCase
} from './application/index.js';
import {
  LocationEntity,
  GeocodingCacheEntity,
  LocationRepositoryAdapter,
  LocationProviderAdapter,
  GeocodingCacheRepositoryAdapter,
  NominatimGeocodingProvider
} from './infrastructure/index.js';
import { createGeolocationController } from './presentation/http/geolocation.controller.js';
import { createGeolocationRouter } from './presentation/http/geolocation.routes.js';
import { reserveGeocodingSlot } from './infrastructure/persistence/adapters/geocoding-request-slot.js';

export interface CreateGeolocationModuleDependencies {
  dataSource: DataSource;
  cities: CityProvider;
  countries: CountryProvider;
  users: UserProvider;
  requireAuth: RequestHandler;
  geocodingProvider?: GeocodingProvider;
  reverseGeocodingProvider?: ReverseGeocodingProvider;
}

export function createGeolocationModule({
  dataSource,
  cities,
  countries,
  users,
  requireAuth,
  geocodingProvider,
  reverseGeocodingProvider
}: CreateGeolocationModuleDependencies) {
  const locationRepository = new LocationRepositoryAdapter(
    dataSource.getRepository(LocationEntity)
  );

  const cacheRepository = new GeocodingCacheRepositoryAdapter(
    dataSource.getRepository(GeocodingCacheEntity)
  );

  const defaultNominatim = new NominatimGeocodingProvider({
    baseUrl: env.NOMINATIM_BASE_URL,
    acquireSlot: () => reserveGeocodingSlot(dataSource)
  });
  const geoProvider = geocodingProvider ?? defaultNominatim;
  const reverseGeoProvider = reverseGeocodingProvider ?? defaultNominatim;

  const createLocation = new CreateLocationUseCase(locationRepository, cities, countries, users);

  const searchNearby = new SearchLocationsNearbyUseCase(locationRepository, {
    defaultRadiusMeters: 5000,
    minRadiusMeters: 100,
    maxRadiusMeters: 100_000,
    defaultLimit: 50,
    maxLimit: 200
  });

  const searchInBBox = new SearchLocationsInBBoxUseCase(locationRepository, {
    maxBBoxSpanDegrees: 5,
    defaultLimit: 100,
    maxLimit: 500
  });

  const geocodeAddress = new GeocodeAddressUseCase(geoProvider, cacheRepository, {
    cacheTtlSeconds: 30 * 24 * 3600
  });

  const reverseGeocode = new ReverseGeocodeUseCase(reverseGeoProvider);

  const discoverableLocations = {
    findById: (id: string) => locationRepository.findDiscoverableById(id)
  };
  const controller = createGeolocationController({
    createLocation,
    findExactById: (id, viewerId) => locationRepository.findExactById(id, viewerId),
    findPublicLocationById: new FindPublicLocationByIdUseCase(discoverableLocations),
    searchNearby,
    searchInBBox,
    geocodeAddress,
    reverseGeocode
  });

  const router = createGeolocationRouter(controller, requireAuth);

  const locations: LocationProvider = new LocationProviderAdapter(
    locationRepository,
    createLocation
  );

  return {
    router,
    locations,
    startCacheCleanup: () =>
      startBatchWorker(
        async () => {
          await cacheRepository.deleteExpired();
          return false;
        },
        60 * 60_000,
        'Geocoding cache cleanup failed'
      )
  };
}

export type GeolocationModule = ReturnType<typeof createGeolocationModule>;
