import type { ValueTransformer } from 'typeorm';
import type { GeoJSONPolygon } from '../types/geojson.js';

function isGeoJSONPolygon(value: unknown): value is GeoJSONPolygon {
  if (typeof value !== 'object' || value === null) return false;

  const polygon = value as Record<string, unknown>;

  return polygon.type === 'Polygon' && Array.isArray(polygon.coordinates);
}

export const geojsonPolygonTransformer: ValueTransformer = {
  to(value: GeoJSONPolygon | null | undefined): string | null {
    if (value === null || value === undefined) return null;

    const rings = value.coordinates
      .map((ring) => ring.map(([lng, lat]) => `${lng} ${lat}`).join(', '))
      .join('), (');

    return `POLYGON((${rings}))`;
  },

  from(value: unknown): GeoJSONPolygon | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
      const match = value.match(/^POLYGON\s*\(\((.*)\)\)$/i);
      if (!match) return null;

      const rings = match[1].split(/\)\s*,\s*\(/);

      const coordinates = rings.map((ring) =>
        ring.split(',').map((pair) => {
          const values = pair.trim().split(/\s+/).map(Number);

          if (values.length !== 2 || !values.every(Number.isFinite)) {
            return null;
          }

          return [values[0], values[1]] as [number, number];
        })
      );

      if (coordinates.some((ring) => ring.some((point) => point === null))) {
        return null;
      }

      return {
        type: 'Polygon',
        coordinates: coordinates as GeoJSONPolygon['coordinates']
      };
    }

    if (isGeoJSONPolygon(value)) {
      return value;
    }

    return null;
  }
};
