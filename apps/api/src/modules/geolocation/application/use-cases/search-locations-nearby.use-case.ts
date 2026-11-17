import type { LocationRepository, NearbyLocationResult } from '../ports/location.repository.js';
import type { Coordinates } from '../../../../common/index.js';
import type { PublicLocationView } from '../../domain/index.js';
import { isValidCoordinates, InvalidCoordinatesError, toLocationView } from '../../domain/index.js';

export interface SearchNearbyInput {
  coordinates: Coordinates;
  radiusMeters?: number;
  limit?: number;
}

export interface NearbySearchResultItem {
  location: PublicLocationView;
  distanceMeters: number;
}

export interface SearchNearbyUseCaseConfig {
  defaultRadiusMeters: number;
  minRadiusMeters: number;
  maxRadiusMeters: number;
  defaultLimit: number;
  maxLimit: number;
}

export class SearchLocationsNearbyUseCase {
  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly config: SearchNearbyUseCaseConfig
  ) {}

  async execute(input: SearchNearbyInput): Promise<NearbySearchResultItem[]> {
    if (!isValidCoordinates(input.coordinates)) {
      throw new InvalidCoordinatesError();
    }

    const radius = Math.min(
      Math.max(input.radiusMeters ?? this.config.defaultRadiusMeters, this.config.minRadiusMeters),
      this.config.maxRadiusMeters
    );

    const limit = Math.min(
      Math.max(input.limit ?? this.config.defaultLimit, 1),
      this.config.maxLimit
    );

    const results: NearbyLocationResult[] = await this.locationRepository.findNearby(
      input.coordinates,
      radius,
      limit
    );

    return results.map((item) => ({
      location: toLocationView(item.location, 'PUBLIC'),
      distanceMeters: Math.round(item.distanceMeters)
    }));
  }
}
