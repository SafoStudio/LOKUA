import type { Coordinates } from '../../../../common/index.js';

export function isValidCoordinates(coords: Coordinates | null | undefined): boolean {
  if (!coords) return false;
  if (typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
    return false;
  }
  if (Number.isNaN(coords.latitude) || Number.isNaN(coords.longitude)) {
    return false;
  }
  return (
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
}

/**
 * Rounds public coordinates to two decimal places, about 1.1 km per latitude degree hundredth.
 */
export function obfuscateCoordinates(coords: Coordinates): Coordinates {
  return {
    latitude: Math.round(coords.latitude * 100) / 100,
    longitude: Math.round(coords.longitude * 100) / 100
  };
}
