import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1793875162054 implements MigrationInterface {
  name = 'InitialSchema1793875162054';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "name" character varying(100) NOT NULL, "email_verified" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_users_email" ON "users"  ("email") `);
    await queryRunner.query(
      `CREATE TABLE "google_credentials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "google_sub" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7a6d9466fd05f8c23d7642a7b24" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_google_credentials_user_id" ON "google_credentials"  ("user_id") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_google_credentials_sub" ON "google_credentials"  ("google_sub") `
    );
    await queryRunner.query(
      `CREATE TABLE "passkey_credentials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "credential_id" text NOT NULL, "public_key" bytea NOT NULL, "counter" bigint NOT NULL DEFAULT '0', "transports" text array, "backed_up" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c3c843f6c62f3d35e4de5a26c89" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_passkey_credentials_user_id" ON "passkey_credentials"  ("user_id") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_passkey_credentials_credential_id" ON "passkey_credentials"  ("credential_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "password_credentials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "password_hash" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c7302926c19b0b92389e3d3b27a" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_password_credentials_user_id" ON "password_credentials"  ("user_id") `
    );
    await queryRunner.query(
      `ALTER TABLE "google_credentials" ADD CONSTRAINT "FK_786219b7ff3443cd8cc08490fd3" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "passkey_credentials" ADD CONSTRAINT "FK_91cd69b8ae1aead8f3ff989f5aa" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "password_credentials" ADD CONSTRAINT "FK_9b6358b8110bfd9267608e85e0d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "password_credentials" DROP CONSTRAINT "FK_9b6358b8110bfd9267608e85e0d"`
    );
    await queryRunner.query(
      `ALTER TABLE "passkey_credentials" DROP CONSTRAINT "FK_91cd69b8ae1aead8f3ff989f5aa"`
    );
    await queryRunner.query(
      `ALTER TABLE "google_credentials" DROP CONSTRAINT "FK_786219b7ff3443cd8cc08490fd3"`
    );
    await queryRunner.query(`DROP INDEX "public"."idx_password_credentials_user_id"`);
    await queryRunner.query(`DROP TABLE "password_credentials"`);
    await queryRunner.query(`DROP INDEX "public"."idx_passkey_credentials_credential_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_passkey_credentials_user_id"`);
    await queryRunner.query(`DROP TABLE "passkey_credentials"`);
    await queryRunner.query(`DROP INDEX "public"."idx_google_credentials_sub"`);
    await queryRunner.query(`DROP INDEX "public"."idx_google_credentials_user_id"`);
    await queryRunner.query(`DROP TABLE "google_credentials"`);
    await queryRunner.query(`DROP INDEX "public"."idx_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
