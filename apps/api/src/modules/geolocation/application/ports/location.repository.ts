import type { Location } from '../../domain/index.js';
import type { Coordinates } from '../../../../common/index.js';

export interface CreateLocationInput {
  name: string;
  address: string;
  cityId: string;
  districtId: string | null;
  countryCode: string;
  exactCoordinates: Coordinates;
  publicCoordinates: Coordinates;
  provider: string;
  providerPlaceId: string | null;
  createdBy: string | null;
}

export interface NearbyLocationResult {
  location: Location;
  distanceMeters: number;
}

export interface LocationRepository {
  findById(id: string): Promise<Location | null>;
  create(input: CreateLocationInput): Promise<Location>;
  findNearby(
    coordinates: Coordinates,
    radiusMeters: number,
    limit: number
  ): Promise<NearbyLocationResult[]>;
  findInBBox(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
    limit: number
  ): Promise<Location[]>;
  search(query: string, cityId: string | null, limit: number): Promise<Location[]>;
}
