import type { MigrationInterface, QueryRunner } from 'typeorm';
import { kyivDistricts } from '../kyiv-districts.js';

const districtId = (code: string) => `2fd7eb45-8ed1-4d32-bfa1-00${code}`;

export class SeedKyivDistricts1795040000000 implements MigrationInterface {
  name = 'SeedKyivDistricts1795040000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const { code, name, geometry } of kyivDistricts) {
      await queryRunner.query(
        `WITH district AS (
           SELECT ST_ForcePolygonCCW(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)) AS boundary
         ), district_center AS (
           SELECT boundary, ST_Centroid(boundary) AS centroid FROM district
         )
         INSERT INTO districts (id, city_id, name, center, boundary)
         SELECT $1, city.id, $2,
           (CASE WHEN ST_Covers(boundary, centroid) THEN centroid
                 ELSE ST_PointOnSurface(boundary) END)::geography,
           boundary::geography
         FROM cities city CROSS JOIN district_center
         WHERE city.country_code = 'UA' AND city.slug = 'kyiv'
         ON CONFLICT (city_id, name) DO NOTHING`,
        [districtId(code), name, JSON.stringify(geometry)]
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM districts WHERE id = ANY($1::uuid[])', [
      kyivDistricts.map(({ code }) => districtId(code))
    ]);
  }
}
