import type { MigrationInterface, QueryRunner } from 'typeorm';

export class QueueDeletedAccountMedia1795784659657 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users ADD COLUMN media_cleanup_at timestamptz');
    await queryRunner.query(
      'CREATE INDEX idx_users_media_cleanup_at ON users (media_cleanup_at, id) WHERE media_cleanup_at IS NOT NULL'
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_users_media_cleanup_at');
    await queryRunner.query('ALTER TABLE users DROP COLUMN media_cleanup_at');
  }
}
