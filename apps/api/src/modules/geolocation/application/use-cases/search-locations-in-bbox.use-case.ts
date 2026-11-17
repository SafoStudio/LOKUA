import type { LocationRepository } from '../ports/location.repository.js';
import type { PublicLocationView } from '../../domain/index.js';
import {
  BoundingBoxTooLargeError,
  InvalidCoordinatesError,
  toLocationView
} from '../../domain/index.js';

export interface SearchInBBoxInput {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
  limit?: number;
}

export interface SearchInBBoxUseCaseConfig {
  maxBBoxSpanDegrees: number;
  defaultLimit: number;
  maxLimit: number;
}

export class SearchLocationsInBBoxUseCase {
  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly config: SearchInBBoxUseCaseConfig
  ) {}

  async execute(input: SearchInBBoxInput): Promise<PublicLocationView[]> {
    if (
      input.minLat < -90 ||
      input.maxLat > 90 ||
      input.minLng < -180 ||
      input.maxLng > 180 ||
      input.minLat >= input.maxLat ||
      input.minLng >= input.maxLng
    ) {
      throw new InvalidCoordinatesError('Invalid bounding box boundaries');
    }

    const latSpan = Math.abs(input.maxLat - input.minLat);
    const lngSpan = Math.abs(input.maxLng - input.minLng);

    if (latSpan > this.config.maxBBoxSpanDegrees || lngSpan > this.config.maxBBoxSpanDegrees) {
      throw new BoundingBoxTooLargeError(this.config.maxBBoxSpanDegrees);
    }

    const limit = Math.min(
      Math.max(input.limit ?? this.config.defaultLimit, 1),
      this.config.maxLimit
    );

    const locations = await this.locationRepository.findInBBox(
      input.minLat,
      input.minLng,
      input.maxLat,
      input.maxLng,
      limit
    );

    return locations.map((loc) => toLocationView(loc, 'PUBLIC'));
  }
}
