import type { DataSource } from 'typeorm';
import type { CityProvider, CountryProvider } from '../dictionaries/index.js';
import type { UserProvider } from '../users/index.js';
import type {
  CreateLocationInput,
  FindLocationByIdInput,
  SearchNearbyInput,
  SearchInBBoxInput,
  GeocodingProvider,
  ReverseGeocodingProvider,
  LocationProvider
} from './application/index.js';
import {
  CreateLocationUseCase,
  FindLocationByIdUseCase,
  FindPublicLocationByIdUseCase,
  SearchLocationsNearbyUseCase,
  SearchLocationsInBBoxUseCase,
  GeocodeAddressUseCase,
  ReverseGeocodeUseCase
} from './application/index.js';
import type { Coordinates } from '../../common/index.js';
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

export interface CreateGeolocationModuleDependencies {
  dataSource: DataSource;
  cities: CityProvider;
  countries: CountryProvider;
  users: UserProvider;
  geocodingProvider?: GeocodingProvider;
  reverseGeocodingProvider?: ReverseGeocodingProvider;
}

export function createGeolocationModule({
  dataSource,
  cities,
  countries,
  users,
  geocodingProvider,
  reverseGeocodingProvider
}: CreateGeolocationModuleDependencies) {
  const locationRepository = new LocationRepositoryAdapter(
    dataSource.getRepository(LocationEntity)
  );

  const cacheRepository = new GeocodingCacheRepositoryAdapter(
    dataSource.getRepository(GeocodingCacheEntity)
  );

  const defaultNominatim = new NominatimGeocodingProvider();
  const geoProvider = geocodingProvider ?? defaultNominatim;
  const reverseGeoProvider = reverseGeocodingProvider ?? defaultNominatim;

  const createLocation = new CreateLocationUseCase(locationRepository, cities, countries, users);
  const findLocationById = new FindLocationByIdUseCase(locationRepository);
  const findPublicLocationById = new FindPublicLocationByIdUseCase(locationRepository);

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

  const controller = createGeolocationController({
    createLocation,
    findLocationById,
    findPublicLocationById,
    searchNearby,
    searchInBBox,
    geocodeAddress,
    reverseGeocode
  });

  const router = createGeolocationRouter(controller);

  const locations: LocationProvider = new LocationProviderAdapter(
    locationRepository,
    createLocation
  );

  return {
    router,
    locations,

    createLocation: (input: CreateLocationInput) => createLocation.execute(input),
    findLocationById: (input: FindLocationByIdInput) => findLocationById.execute(input),
    findPublicLocationById: (input: FindLocationByIdInput) => findPublicLocationById.execute(input),
    searchNearby: (input: SearchNearbyInput) => searchNearby.execute(input),
    searchInBBox: (input: SearchInBBoxInput) => searchInBBox.execute(input),
    geocode: (address: string, city?: string) => geocodeAddress.execute({ address, city }),
    reverseGeocode: (coords: Coordinates) => reverseGeocode.execute(coords)
  };
}

export type GeolocationModule = ReturnType<typeof createGeolocationModule>;
