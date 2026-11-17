import { AppError } from '../../../common/index.js';

export class InvalidCoordinatesError extends AppError {
  constructor(
    message = 'Invalid coordinates. Latitude must be in [-90, 90], Longitude in [-180, 180]'
  ) {
    super(message, 400);
    this.name = 'InvalidCoordinatesError';
  }
}

export class LocationNotFoundError extends AppError {
  constructor(id: string) {
    super(`Location with id '${id}' not found`, 404);
    this.name = 'LocationNotFoundError';
  }
}

export class GeocodingNotFoundError extends AppError {
  constructor(query: string) {
    super(`Geocoding result not found for query '${query}'`, 404);
    this.name = 'GeocodingNotFoundError';
  }
}

export class GeocodingProviderError extends AppError {
  constructor(provider: string, detail: string) {
    super(`Geocoding provider '${provider}' error: ${detail}`, 502);
    this.name = 'GeocodingProviderError';
  }
}

export class LocationValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'LocationValidationError';
  }
}

export class BoundingBoxTooLargeError extends AppError {
  constructor(maxDegrees = 5) {
    super(`Bounding box spans too wide an area (maximum allowed is ${maxDegrees} degrees)`, 400);
    this.name = 'BoundingBoxTooLargeError';
  }
}
