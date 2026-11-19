import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOnboardingSchema1794923437553 implements MigrationInterface {
  name = 'AddOnboardingSchema1794923437553';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "onboarding_states" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "current_step" character varying(30) NOT NULL DEFAULT 'DATE_OF_BIRTH', "completed_steps" character varying(30) array NOT NULL DEFAULT '{}', "date_of_birth" date, "name" character varying(100), "main_photo_url" text, "city_id" uuid, "interest_ids" uuid array, "bio" character varying(300), "languages" text array, "social_links" jsonb, "completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_onboarding_states_user_id" UNIQUE ("user_id"), CONSTRAINT "PK_6d6c8e47268bb17679e7c724dfb" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_onboarding_states_user_id" ON "onboarding_states"  ("user_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_onboarding_states_current_step" ON "onboarding_states"  ("current_step") `
    );
    await queryRunner.query(
      `ALTER TABLE "onboarding_states" ADD CONSTRAINT "FK_25dcf7732f0dd1356abd19fab59" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "onboarding_states" ADD CONSTRAINT "FK_89b483a7126848ac7f9701f4e98" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "onboarding_states" DROP CONSTRAINT "FK_89b483a7126848ac7f9701f4e98"`
    );
    await queryRunner.query(
      `ALTER TABLE "onboarding_states" DROP CONSTRAINT "FK_25dcf7732f0dd1356abd19fab59"`
    );
    await queryRunner.query(`DROP INDEX "public"."idx_onboarding_states_current_step"`);
    await queryRunner.query(`DROP INDEX "public"."idx_onboarding_states_user_id"`);
    await queryRunner.query(`DROP TABLE "onboarding_states"`);
  }
}
