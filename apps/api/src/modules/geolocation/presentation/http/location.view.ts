import type { Location, PublicLocationView } from '../../domain/index.js';
import type { NearbySearchResultItem } from '../../application/index.js';

export interface LocationView {
  id: string;
  name: string;
  address: string;
  cityId: string;
  districtId: string | null;
  countryCode: string;
  exactCoordinates: { latitude: number; longitude: number };
  publicCoordinates: { latitude: number; longitude: number };
  provider: string;
  providerPlaceId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NearbyLocationItemView {
  location: PublicLocationView;
  distanceMeters: number;
}

export function toLocationView(location: Location): LocationView {
  return {
    id: location.id,
    name: location.name,
    address: location.address,
    cityId: location.cityId,
    districtId: location.districtId,
    countryCode: location.countryCode,
    exactCoordinates: location.exactCoordinates,
    publicCoordinates: location.publicCoordinates,
    provider: location.provider,
    providerPlaceId: location.providerPlaceId,
    createdBy: location.createdBy,
    createdAt:
      location.createdAt instanceof Date
        ? location.createdAt.toISOString()
        : String(location.createdAt),
    updatedAt:
      location.updatedAt instanceof Date
        ? location.updatedAt.toISOString()
        : String(location.updatedAt)
  };
}

export function toNearbyLocationItemView(item: NearbySearchResultItem): NearbyLocationItemView {
  return {
    location: item.location,
    distanceMeters: item.distanceMeters
  };
}
