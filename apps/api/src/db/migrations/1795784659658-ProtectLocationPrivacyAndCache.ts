import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProtectLocationPrivacyAndCache1795784659658 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE locations ADD COLUMN is_private boolean NOT NULL DEFAULT false'
    );
    await queryRunner.query('UPDATE locations SET is_private = true WHERE created_by IS NOT NULL');
    await queryRunner.query('ALTER TABLE geocoding_cache ADD COLUMN provider_place_id text');
    await queryRunner.query(`CREATE TABLE geocoding_request_slot (
      id boolean PRIMARY KEY CHECK (id),
      next_request_at timestamptz NOT NULL
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE geocoding_request_slot');
    await queryRunner.query('ALTER TABLE geocoding_cache DROP COLUMN provider_place_id');
    await queryRunner.query('ALTER TABLE locations DROP COLUMN is_private');
  }
}
