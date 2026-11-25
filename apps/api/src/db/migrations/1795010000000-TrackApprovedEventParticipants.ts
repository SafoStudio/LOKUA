import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TrackApprovedEventParticipants1795010000000 implements MigrationInterface {
  name = 'TrackApprovedEventParticipants1795010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "has_approved_participants" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "has_approved_participants"`);
  }
}
