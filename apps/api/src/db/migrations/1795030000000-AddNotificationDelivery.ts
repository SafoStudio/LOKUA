import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationDelivery1795030000000 implements MigrationInterface {
  name = 'AddNotificationDelivery1795030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "deduplication_key" character varying(180)`
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "email_due_at" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "email_attempts" integer NOT NULL DEFAULT '0'`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_notifications_enabled" boolean NOT NULL DEFAULT true`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_email_due" ON "notifications" ("email_due_at")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_notifications_deduplication" ON "notifications" ("deduplication_key")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_notifications_deduplication"`);
    await queryRunner.query(`DROP INDEX "public"."idx_notifications_email_due"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_notifications_enabled"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "email_attempts"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "email_due_at"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "deduplication_key"`);
  }
}
