import type { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenAuthSessions1795784659656 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DELETE FROM passkey_challenges WHERE type = 'REGISTRATION'");
    await queryRunner.query('ALTER TABLE users ADD COLUMN session_version uuid');
    await queryRunner.query(
      'ALTER TABLE refresh_sessions ADD COLUMN rotated_at timestamptz, ADD COLUMN family_id uuid'
    );
    await queryRunner.query(
      'CREATE INDEX idx_refresh_sessions_family_id ON refresh_sessions (family_id)'
    );
    await queryRunner.query(
      'CREATE TABLE auth_rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL)'
    );
    await queryRunner.query(
      'CREATE INDEX idx_auth_rate_limits_expiry ON auth_rate_limits (expires_at)'
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE auth_rate_limits');
    await queryRunner.query('DROP INDEX idx_refresh_sessions_family_id');
    await queryRunner.query(
      'ALTER TABLE refresh_sessions DROP COLUMN rotated_at, DROP COLUMN family_id'
    );
    await queryRunner.query('ALTER TABLE users DROP COLUMN session_version');
  }
}
