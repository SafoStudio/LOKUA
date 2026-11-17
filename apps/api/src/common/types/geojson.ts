export type GeoJSONPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type GeoJSONMultiPolygon = {
  type: 'MultiPolygon';
  coordinates: number[][][][];
};

export type GeoJSONGeometry = GeoJSONPolygon | GeoJSONMultiPolygon;
