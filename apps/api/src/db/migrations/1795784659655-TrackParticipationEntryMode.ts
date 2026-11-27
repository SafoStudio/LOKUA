import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TrackParticipationEntryMode1795784659655 implements MigrationInterface {
  name = 'TrackParticipationEntryMode1795784659655';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_participations" ADD "entry_mode" character varying(10)`
    );
    await queryRunner.query(`
      UPDATE event_participations participation
      SET entry_mode = CASE
        WHEN participation.status IN ('PENDING', 'REJECTED', 'NOT_CONSIDERED')
          OR participation.application_message IS NOT NULL THEN 'REQUEST'
        ELSE event.participation_mode
      END
      FROM events event
      WHERE event.id = participation.event_id AND event.organizer_id <> participation.user_id
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "event_participations" DROP COLUMN "entry_mode"`);
  }
}
