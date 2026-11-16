import type { ValueTransformer } from 'typeorm';
import type { GeoJSONPolygon } from '../../../../../common/index.js';

/**
 * PostGIS <-> GeoJSON transformer.
 *
 * to:   GeoJSONPolygon | null -> WKT string | null
 * from: WKT string | null     -> GeoJSONPolygon | null
 *
 */
export const geojsonPolygonTransformer: ValueTransformer = {
  to(value: GeoJSONPolygon | null): string | null {
    if (value === null || value === undefined) return null;
    return polygonToWkt(value);
  },

  from(value: string | null): GeoJSONPolygon | null {
    if (value === null || value === undefined) return null;
    return wktToPolygon(value);
  }
};

function polygonToWkt(polygon: GeoJSONPolygon): string {
  const rings = polygon.coordinates
    .map((ring) => ring.map(([lng, lat]) => `${lng} ${lat}`).join(', '))
    .join('), (');
  return `POLYGON((${rings}))`;
}

function wktToPolygon(wkt: string): GeoJSONPolygon | null {
  const match = wkt.match(/^POLYGON\s*\(\((.*)\)\)$/i);
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
