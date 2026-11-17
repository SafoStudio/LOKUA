import type { Coordinates } from '../../../../common/index.js';

export function isValidCoordinates(coords: Coordinates): boolean {
  return (
    typeof coords.latitude === 'number' &&
    typeof coords.longitude === 'number' &&
    !Number.isNaN(coords.latitude) &&
    !Number.isNaN(coords.longitude) &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
}

/**
 * Computes an obfuscated / public coordinate pair for privacy protection (A.2.2).
 * Rounds to 2 decimal places (~1.1 km precision) to show the general area without revealing exact address.
 */
export function obfuscateCoordinates(coords: Coordinates): Coordinates {
  return {
    latitude: Math.round(coords.latitude * 100) / 100,
    longitude: Math.round(coords.longitude * 100) / 100
  };
}
