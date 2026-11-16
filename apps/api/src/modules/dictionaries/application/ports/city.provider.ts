import type { GeoJSONPolygon } from '../../../../common/index.js';

export type City = {
  id: string;
  countryCode: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  bbox: GeoJSONPolygon | null;
  timezone: string;
  isActive: boolean;
};

export interface CityProvider {
  findById(id: string): Promise<City | null>;
  findBySlug(slug: string): Promise<City | null>;
  listActive(): Promise<City[]>;
}
