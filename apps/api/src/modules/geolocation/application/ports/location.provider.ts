import type { Coordinates } from '../../../../common/index.js';
import type { Location, PublicLocationView } from '../../domain/index.js';

export interface CreateLocationProviderInput {
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

export interface LocationProvider {
  findById(id: string): Promise<Location | null>;
  findPublicById(id: string): Promise<PublicLocationView | null>;
  create(input: CreateLocationProviderInput): Promise<Location>;
}
