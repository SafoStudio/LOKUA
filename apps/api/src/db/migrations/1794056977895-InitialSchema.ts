import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1794056977895 implements MigrationInterface {
  name = 'InitialSchema1794056977895';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "email_verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_417a095bbed21c2369a6a01ab9a" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_email_verification_tokens_user_id" ON "email_verification_tokens"  ("user_id") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_email_verification_tokens_token_hash" ON "email_verification_tokens"  ("token_hash") `
    );
    await queryRunner.query(
      `CREATE TABLE "passkey_challenges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "challenge" character varying(255) NOT NULL, "type" character varying(20) NOT NULL, "user_id" uuid, "email" character varying(255), "name" character varying(100), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6e53152b7ac3d0c599f2cffdd7e" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_passkey_challenges_challenge" ON "passkey_challenges"  ("challenge") `
    );
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
      `CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens"  ("user_id") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_password_reset_tokens_token_hash" ON "password_reset_tokens"  ("token_hash") `
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_sessions" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_9190032f6967b7971dca07d69f3" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_sessions_user_id" ON "refresh_sessions"  ("user_id") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_refresh_sessions_token_hash" ON "refresh_sessions"  ("token_hash") `
    );
    await queryRunner.query(
      `CREATE TABLE "security_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "event_type" character varying(64) NOT NULL, "ip" character varying(45), "user_agent" text, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6fc100d6700780737348df0d3ae" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_security_events_user_id" ON "security_events"  ("user_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_security_events_event_type" ON "security_events"  ("event_type") `
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "name" character varying(100) NOT NULL, "email_verified" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_users_email" ON "users"  ("email") `);
    await queryRunner.query(
      `ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "fk_email_verification_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "google_credentials" ADD CONSTRAINT "fk_google_credentials_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "passkey_credentials" ADD CONSTRAINT "fk_passkey_credentials_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "password_credentials" ADD CONSTRAINT "fk_password_credentials_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "fk_password_reset_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_sessions" ADD CONSTRAINT "fk_refresh_sessions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_sessions" DROP CONSTRAINT "fk_refresh_sessions_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "fk_password_reset_tokens_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "password_credentials" DROP CONSTRAINT "fk_password_credentials_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "passkey_credentials" DROP CONSTRAINT "fk_passkey_credentials_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "google_credentials" DROP CONSTRAINT "fk_google_credentials_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "email_verification_tokens" DROP CONSTRAINT "fk_email_verification_tokens_user_id"`
    );
    await queryRunner.query(`DROP INDEX "public"."idx_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP INDEX "public"."idx_security_events_event_type"`);
    await queryRunner.query(`DROP INDEX "public"."idx_security_events_user_id"`);
    await queryRunner.query(`DROP TABLE "security_events"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_sessions_token_hash"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_sessions_user_id"`);
    await queryRunner.query(`DROP TABLE "refresh_sessions"`);
    await queryRunner.query(`DROP INDEX "public"."idx_password_reset_tokens_token_hash"`);
    await queryRunner.query(`DROP INDEX "public"."idx_password_reset_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."idx_password_credentials_user_id"`);
    await queryRunner.query(`DROP TABLE "password_credentials"`);
    await queryRunner.query(`DROP INDEX "public"."idx_passkey_credentials_credential_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_passkey_credentials_user_id"`);
    await queryRunner.query(`DROP TABLE "passkey_credentials"`);
    await queryRunner.query(`DROP INDEX "public"."idx_google_credentials_sub"`);
    await queryRunner.query(`DROP INDEX "public"."idx_google_credentials_user_id"`);
    await queryRunner.query(`DROP TABLE "google_credentials"`);
    await queryRunner.query(`DROP INDEX "public"."idx_passkey_challenges_challenge"`);
    await queryRunner.query(`DROP TABLE "passkey_challenges"`);
    await queryRunner.query(`DROP INDEX "public"."idx_email_verification_tokens_token_hash"`);
    await queryRunner.query(`DROP INDEX "public"."idx_email_verification_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
  }
}
