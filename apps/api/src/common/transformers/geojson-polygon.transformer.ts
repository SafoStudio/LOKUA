import type { ValueTransformer } from 'typeorm';
import type { GeoJSONPolygon } from '../types/geojson.js';

export const geojsonPolygonTransformer: ValueTransformer = {
  to(value: GeoJSONPolygon | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const rings = value.coordinates
      .map((ring) => ring.map(([lng, lat]) => `${lng} ${lat}`).join(', '))
      .join('), (');
    return `POLYGON((${rings}))`;
  },

  from(value: string | null | undefined): GeoJSONPolygon | null {
    if (value === null || value === undefined) return null;
    const match = value.match(/^POLYGON\s*\(\((.*)\)\)$/i);
    if (!match) return null;
    const rings = match[1].split(/\)\s*,\s*\(/);
    const coordinates = rings.map((ring) =>
      ring.split(',').map((pair) => {
        const [lng, lat] = pair.trim().split(/\s+/).map(Number);
        return [lng, lat];
      })
    );
    return { type: 'Polygon', coordinates };
  }
};
