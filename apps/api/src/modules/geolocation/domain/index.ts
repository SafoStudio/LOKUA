export type { EventFormat } from './types/event-format.js';
export type { PrecisionLevel } from './types/precision-level.js';

export { isValidCoordinates, obfuscateCoordinates } from './utils/coordinates.js';

export type { Location, PublicLocationView } from './models/location.js';
export { toLocationView } from './models/location.js';

export type { GeocodingCache } from './models/geocoding-cache.js';
export type { GeoMarker } from './models/geo-marker.js';

export {
  InvalidCoordinatesError,
  LocationNotFoundError,
  GeocodingNotFoundError,
  GeocodingProviderError,
  BoundingBoxTooLargeError,
  LocationValidationError
} from './errors.js';
