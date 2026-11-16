import type { Coordinates } from '../../../../common/index.js';
import type { PrecisionLevel } from '../types/precision-level.js';

export interface Location {
  id: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicLocationView {
  id: string;
  name: string;
  cityId: string;
  districtId: string | null;
  countryCode: string;
  coordinates: Coordinates;
  isExact: boolean;
  address?: string;
}

export function toLocationView(location: Location, precision: PrecisionLevel): PublicLocationView {
  if (precision === 'EXACT') {
    return {
      id: location.id,
      name: location.name,
      address: location.address,
      cityId: location.cityId,
      districtId: location.districtId,
      countryCode: location.countryCode,
      coordinates: location.exactCoordinates,
      isExact: true
    };
  }

  return {
    id: location.id,
    name: location.name,
    cityId: location.cityId,
    districtId: location.districtId,
    countryCode: location.countryCode,
    coordinates: location.publicCoordinates,
    isExact: false
  };
}
