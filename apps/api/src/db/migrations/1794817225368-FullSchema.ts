import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FullSchema1794817225368 implements MigrationInterface {
  name = 'FullSchema1794817225368';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_users_email"`);
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "slug" character varying(100) NOT NULL, "icon" character varying(100), "order_num" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_categories_slug" UNIQUE ("slug"), CONSTRAINT "uq_categories_name" UNIQUE ("name"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "countries" ("code" character(2) NOT NULL, "name" character varying(100) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b47cbb5311bad9c9ae17b8c1eda" PRIMARY KEY ("code"))`
    );
    await queryRunner.query(
      `CREATE TABLE "cities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "country_code" character(2) NOT NULL DEFAULT 'UA', "name" character varying(100) NOT NULL, "slug" character varying(100) NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "bbox" geography(Polygon,4326), "timezone" character varying(64) NOT NULL DEFAULT 'Europe/Kyiv', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_cities_country_slug" UNIQUE ("country_code", "slug"), CONSTRAINT "PK_4762ffb6e5d198cfec5606bc11e" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE INDEX "idx_cities_bbox" ON "cities" USING gist ("bbox") `);
    await queryRunner.query(
      `CREATE TABLE "interests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_interests_name" UNIQUE ("name"), CONSTRAINT "PK_a2dc7b6f9a8bcf9e3f9312a879d" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "discussion_comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_id" uuid NOT NULL, "author_id" uuid NOT NULL, "parent_id" uuid, "text" character varying(1000) NOT NULL, "is_edited" boolean NOT NULL DEFAULT false, "is_archived" boolean NOT NULL DEFAULT false, "is_hidden_by_admin" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_98f6ea88dfa420d7524d700195f" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_discussion_comments_event_id" ON "discussion_comments"  ("event_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_discussion_comments_author_id" ON "discussion_comments"  ("author_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_discussion_comments_parent_id" ON "discussion_comments"  ("parent_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "event_location_snapshot" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_id" uuid NOT NULL, "location_id" uuid NOT NULL, "city_id" uuid NOT NULL, "district_id" uuid, "country_code" character(2) NOT NULL DEFAULT 'UA', "name" character varying(255) NOT NULL, "address" text NOT NULL, "coordinates" geography(Point,4326) NOT NULL, "public_coordinates" geography(Point,4326) NOT NULL, "snapshot_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_e23b3e2fe4cd4360c021bdf4e5" UNIQUE ("event_id"), CONSTRAINT "PK_fc8cc2352ddd3791f52267ca7b1" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_event_location_snapshot_event_id" ON "event_location_snapshot"  ("event_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_event_location_snapshot_location_id" ON "event_location_snapshot"  ("location_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_event_location_snapshot_city_id" ON "event_location_snapshot"  ("city_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_event_location_snapshot_district_id" ON "event_location_snapshot"  ("district_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_event_location_snapshot_coordinates" ON "event_location_snapshot" USING gist ("coordinates") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_event_location_snapshot_public_coordinates" ON "event_location_snapshot" USING gist ("public_coordinates") `
    );
    await queryRunner.query(
      `CREATE TABLE "event_occurrences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_id" uuid NOT NULL, "location_id" uuid, "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL, "timezone" character varying(64) NOT NULL DEFAULT 'Europe/Kyiv', "status" character varying(20) NOT NULL DEFAULT 'SCHEDULED', "is_overridden" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_event_occurrences_dates" CHECK ("ends_at" > "starts_at"), CONSTRAINT "PK_43048141833ab7f9c7fc8c47887" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_event_occurrences_event_id" ON "event_occurrences"  ("event_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_event_occurrences_location_id" ON "event_occurrences"  ("location_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_event_occurrences_starts_at" ON "event_occurrences"  ("starts_at") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_event_occurrence_unique_slot" ON "event_occurrences"  ("event_id", "starts_at") `
    );
    await queryRunner.query(
      `CREATE TABLE "event_participations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_id" uuid NOT NULL, "user_id" uuid NOT NULL, "status" character varying(30) NOT NULL, "application_message" character varying(300), "removal_reason" character varying(300), "status_updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_591a28b162350ee6dea2b08739f" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_participations_event_id" ON "event_participations"  ("event_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_participations_user_id" ON "event_participations"  ("user_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_participations_status" ON "event_participations"  ("status") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_participations_unique_pair" ON "event_participations"  ("event_id", "user_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "event_reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_id" uuid NOT NULL, "author_id" uuid NOT NULL, "rating" smallint NOT NULL, "text" character varying(1000), "organizer_reply" character varying(1000), "organizer_reply_at" TIMESTAMP WITH TIME ZONE, "is_pinned" boolean NOT NULL DEFAULT false, "is_hidden_by_admin" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_event_reviews_rating" CHECK ("rating" >= 1 AND "rating" <= 5), CONSTRAINT "PK_eb6847199dbaa944f2c047710f1" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_event_reviews_event_id" ON "event_reviews"  ("event_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_event_reviews_author_id" ON "event_reviews"  ("author_id") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_event_reviews_unique_pair" ON "event_reviews"  ("event_id", "author_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "event_tags" ("event_id" uuid NOT NULL, "tag_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0fce1d3dc22d5c2b86d8eb3c035" PRIMARY KEY ("event_id", "tag_id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizer_id" uuid NOT NULL, "title" character varying(100) NOT NULL, "category_id" uuid NOT NULL, "description" text NOT NULL, "cover_url" text, "media_urls" jsonb NOT NULL DEFAULT '[]', "format" character varying(20) NOT NULL, "primary_location_id" uuid, "online_url" text, "hide_exact_address" boolean NOT NULL DEFAULT false, "capacity_limit" integer, "participation_mode" character varying(20) NOT NULL, "age_restriction" character varying(20) NOT NULL, "is_free" boolean NOT NULL DEFAULT true, "price_text" character varying(100), "items_to_bring" character varying(500), "status" character varying(20) NOT NULL DEFAULT 'DRAFT', "cancellation_reason" character varying(300), "is_hidden_by_admin" boolean NOT NULL DEFAULT false, "first_starts_at" TIMESTAMP WITH TIME ZONE, "first_ends_at" TIMESTAMP WITH TIME ZONE, "timezone" character varying(64) NOT NULL DEFAULT 'Europe/Kyiv', "published_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_events_first_dates" CHECK (("first_starts_at" IS NULL AND "first_ends_at" IS NULL) OR ("first_starts_at" IS NOT NULL AND "first_ends_at" IS NOT NULL AND "first_ends_at" > "first_starts_at")), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_events_organizer_id" ON "events"  ("organizer_id") `
    );
    await queryRunner.query(`CREATE INDEX "idx_events_category_id" ON "events"  ("category_id") `);
    await queryRunner.query(
      `CREATE INDEX "idx_events_primary_location_id" ON "events"  ("primary_location_id") `
    );
    await queryRunner.query(`CREATE INDEX "idx_events_status" ON "events"  ("status") `);
    await queryRunner.query(
      `CREATE INDEX "idx_events_first_starts_at" ON "events"  ("first_starts_at") `
    );
    await queryRunner.query(
      `CREATE TABLE "tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(50) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_tags_name" ON "tags"  ("name") `);
    await queryRunner.query(
      `CREATE TABLE "districts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "city_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "center" geography(Point,4326) NOT NULL, "boundary" geography(Polygon,4326), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_972a72ff4e3bea5c7f43a2b98af" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE INDEX "idx_districts_city_id" ON "districts"  ("city_id") `);
    await queryRunner.query(
      `CREATE INDEX "idx_districts_center" ON "districts" USING gist ("center") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_districts_boundary" ON "districts" USING gist ("boundary") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_districts_city_name" ON "districts"  ("city_id", "name") `
    );
    await queryRunner.query(
      `CREATE TABLE "geocoding_cache" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "query_hash" character varying(64) NOT NULL, "raw_query" text NOT NULL, "formatted_address" text NOT NULL, "city" character varying(100) NOT NULL, "district" character varying(100), "country_code" character(2) NOT NULL DEFAULT 'UA', "coordinates" geography(Point,4326) NOT NULL, "provider" character varying(50) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f039dddb4c87f0729e9f24b2fd1" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_geocoding_cache_hash" ON "geocoding_cache"  ("query_hash") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_geocoding_cache_coordinates" ON "geocoding_cache" USING gist ("coordinates") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_geocoding_cache_expires" ON "geocoding_cache"  ("expires_at") `
    );
    await queryRunner.query(
      `CREATE TABLE "locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "address" text NOT NULL, "city_id" uuid NOT NULL, "district_id" uuid, "country_code" character(2) NOT NULL DEFAULT 'UA', "coordinates" geography(Point,4326) NOT NULL, "public_coordinates" geography(Point,4326) NOT NULL, "provider" character varying(50) NOT NULL DEFAULT 'manual', "provider_place_id" character varying(255), "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7cc1c9e3853b94816c094825e74" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE INDEX "idx_locations_city_id" ON "locations"  ("city_id") `);
    await queryRunner.query(
      `CREATE INDEX "idx_locations_district_id" ON "locations"  ("district_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_locations_coordinates" ON "locations" USING gist ("coordinates") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_locations_public_coordinates" ON "locations" USING gist ("public_coordinates") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_locations_created_by" ON "locations"  ("created_by") `
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" uuid NOT NULL, "action" character varying(100) NOT NULL, "target_type" character varying(50) NOT NULL, "target_id" uuid NOT NULL, "before_state" jsonb, "after_state" jsonb, "reason" text, "ip" character varying(45), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_actor_id" ON "audit_logs"  ("actor_id") `
    );
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_action" ON "audit_logs"  ("action") `);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_target" ON "audit_logs"  ("target_type") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"  ("created_at") `
    );
    await queryRunner.query(
      `CREATE TABLE "reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reporter_id" uuid NOT NULL, "object_type" character varying(20) NOT NULL, "object_id" uuid NOT NULL, "reason" character varying(100) NOT NULL, "text" character varying(500) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'NEW', "assigned_moderator_id" uuid, "resolution_notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reports_reporter_id" ON "reports"  ("reporter_id") `
    );
    await queryRunner.query(`CREATE INDEX "idx_reports_status" ON "reports"  ("status") `);
    await queryRunner.query(
      `CREATE INDEX "idx_reports_moderator_id" ON "reports"  ("assigned_moderator_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reports_object" ON "reports"  ("object_type", "object_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "status_transitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entity_type" character varying(30) NOT NULL, "from_status" character varying(30) NOT NULL, "to_status" character varying(30) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b39031ac00cddef2b3ed135e7b4" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_status_transitions_lookup" ON "status_transitions"  ("entity_type", "from_status") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_status_transitions_unique" ON "status_transitions"  ("entity_type", "from_status", "to_status") `
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "recipient_id" uuid NOT NULL, "type" character varying(50) NOT NULL, "target_type" character varying(50) NOT NULL, "target_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "message" text NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_recipient_id" ON "notifications"  ("recipient_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_is_read" ON "notifications"  ("recipient_id", "is_read") `
    );
    await queryRunner.query(
      `CREATE TABLE "user_blocks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "blocker_id" uuid NOT NULL, "blocked_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_user_blocks_self" CHECK ("blocker_id" <> "blocked_id"), CONSTRAINT "PK_0bae5f5cab7574a84889462187c" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_blocks_blocker_id" ON "user_blocks"  ("blocker_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_blocks_blocked_id" ON "user_blocks"  ("blocked_id") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_user_blocks_unique" ON "user_blocks"  ("blocker_id", "blocked_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "user_interests" ("user_id" uuid NOT NULL, "interest_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ca14bb81355d38c5f6b489179be" PRIMARY KEY ("user_id", "interest_id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "user_photos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "url" text NOT NULL, "order_num" integer NOT NULL DEFAULT '0', "is_primary" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_408dc17e8ec2d9c7cdafcb7ee43" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_photos_user_id" ON "user_photos"  ("user_id") `
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "birth_date" date`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" character varying(20) NOT NULL DEFAULT 'USER'`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "status" character varying(30) NOT NULL DEFAULT 'ACTIVE'`
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "city_id" uuid`);
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" character varying(300)`);
    await queryRunner.query(`ALTER TABLE "users" ADD "languages" text array`);
    await queryRunner.query(`ALTER TABLE "users" ADD "social_links" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "onboarding_completed" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "terms_accepted_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "users" ADD "blocked_until" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deletion_requested_at" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "notification_settings" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")`
    );
    await queryRunner.query(`CREATE INDEX "idx_users_city_id" ON "users"  ("city_id") `);
    await queryRunner.query(
      `ALTER TABLE "cities" ADD CONSTRAINT "FK_36b7590678c98e71c292f338399" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "discussion_comments" ADD CONSTRAINT "FK_ac4c145f6f5486650259beec5f9" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "discussion_comments" ADD CONSTRAINT "FK_0d66eb3bff3eb98f43ba63a3e6e" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "discussion_comments" ADD CONSTRAINT "FK_31879a901b47e99141d2a7f0902" FOREIGN KEY ("parent_id") REFERENCES "discussion_comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "event_location_snapshot" ADD CONSTRAINT "FK_e23b3e2fe4cd4360c021bdf4e53" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "event_location_snapshot" ADD CONSTRAINT "FK_f3d57722beca51915789c80e65d" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "event_location_snapshot" ADD CONSTRAINT "FK_e68a054411f4d1905f3a55ba589" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "event_location_snapshot" ADD CONSTRAINT "FK_4f20393293fadfccf31e054940e" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "event_location_snapshot" ADD CONSTRAINT "FK_add31260609e692adfad0b9be74" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "event_occurrences" ADD CONSTRAINT "FK_2ea7174f7a236c487a87519cecd" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "event_occurrences" ADD CONSTRAINT "FK_f892679568b6f3da0d69717a6ca" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "event_participations" ADD CONSTRAINT "FK_390fd21b5c4e7709dda00266140" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "event_participations" ADD CONSTRAINT "FK_b4736789a5a1cd89f4af38a0623" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "event_reviews" ADD CONSTRAINT "FK_2ac846a09922d70bea98c9b7e21" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "event_reviews" ADD CONSTRAINT "FK_c3a81cdfb88c0fd51f3beb691c7" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "event_tags" ADD CONSTRAINT "FK_640b9db5340d03f53d02a4dca1d" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "event_tags" ADD CONSTRAINT "FK_f80b6bfb86895b578c3083a2e8c" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "FK_14c9ce53a2c2a1c781b8390123e" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "FK_643188b30e049632f80367be4e1" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "FK_65bce733d07f1dc3a6f578b375a" FOREIGN KEY ("primary_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "districts" ADD CONSTRAINT "FK_d7d1704cfb8bc19fb0d9c2f7ced" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "locations" ADD CONSTRAINT "FK_6793ebdac5c08faf9f8d48a2b99" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "locations" ADD CONSTRAINT "FK_70d753bf79185710413df7e22b2" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "locations" ADD CONSTRAINT "FK_fd51fe5f51c2bf968d92bade102" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "locations" ADD CONSTRAINT "FK_190a7ee60db34ef946627cbbe9f" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_177183f29f438c488b5e8510cdb" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_9459b9bf907a3807ef7143d2ead" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_647f5e0283a79c4fcc5cec341b1" FOREIGN KEY ("assigned_moderator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_5332a4daa46fd3f4e6625dd275d" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_blocks" ADD CONSTRAINT "FK_dfcd8a81016d1de587fbd2d70bf" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_blocks" ADD CONSTRAINT "FK_7a0806a54f0ad9ced3e247cacd1" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_interests" ADD CONSTRAINT "FK_cb0511a8fabd1a2ac9912f7a9aa" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_interests" ADD CONSTRAINT "FK_f635c6e4d9fb949a9f62c75053b" FOREIGN KEY ("interest_id") REFERENCES "interests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_photos" ADD CONSTRAINT "FK_1faff88f0aaaa07a7c1fec2d5c4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_photos" DROP CONSTRAINT "FK_1faff88f0aaaa07a7c1fec2d5c4"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_interests" DROP CONSTRAINT "FK_f635c6e4d9fb949a9f62c75053b"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_interests" DROP CONSTRAINT "FK_cb0511a8fabd1a2ac9912f7a9aa"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_blocks" DROP CONSTRAINT "FK_7a0806a54f0ad9ced3e247cacd1"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_blocks" DROP CONSTRAINT "FK_dfcd8a81016d1de587fbd2d70bf"`
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_5332a4daa46fd3f4e6625dd275d"`
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_647f5e0283a79c4fcc5cec341b1"`
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_9459b9bf907a3807ef7143d2ead"`
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_177183f29f438c488b5e8510cdb"`
    );
    await queryRunner.query(
      `ALTER TABLE "locations" DROP CONSTRAINT "FK_190a7ee60db34ef946627cbbe9f"`
    );
    await queryRunner.query(
      `ALTER TABLE "locations" DROP CONSTRAINT "FK_fd51fe5f51c2bf968d92bade102"`
    );
    await queryRunner.query(
      `ALTER TABLE "locations" DROP CONSTRAINT "FK_70d753bf79185710413df7e22b2"`
    );
    await queryRunner.query(
      `ALTER TABLE "locations" DROP CONSTRAINT "FK_6793ebdac5c08faf9f8d48a2b99"`
    );
    await queryRunner.query(
      `ALTER TABLE "districts" DROP CONSTRAINT "FK_d7d1704cfb8bc19fb0d9c2f7ced"`
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_65bce733d07f1dc3a6f578b375a"`
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_643188b30e049632f80367be4e1"`
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_14c9ce53a2c2a1c781b8390123e"`
    );
    await queryRunner.query(
      `ALTER TABLE "event_tags" DROP CONSTRAINT "FK_f80b6bfb86895b578c3083a2e8c"`
    );
    await queryRunner.query(
      `ALTER TABLE "event_tags" DROP CONSTRAINT "FK_640b9db5340d03f53d02a4dca1d"`
    );
    await queryRunner.query(
      `ALTER TABLE "event_reviews" DROP CONSTRAINT "FK_c3a81cdfb88c0fd51f3beb691c7"`
    );
    await queryRunner.query(
      `ALTER TABLE "event_reviews" DROP CONSTRAINT "FK_2ac846a09922d70bea98c9b7e21"`
    );
    await queryRunner.query(
      `ALTER TABLE "event_participations" DROP CONSTRAINT "FK_b4736789a5a1cd89f4af38a0623"`
    );
    await queryRunner.query(
      `ALTER TABLE "event_participations" DROP CONSTRAINT "FK_390fd21b5c4e7709dda00266140"`
    );
    await queryRunner.query(
      `ALTER TABLE "event_occurrences" DROP CONSTRAINT "FK_f892679568b6f3da0d69717a6ca"`
    );
    await queryRunner.query(
      `ALTER TABLE "event_occurrences" DROP CONSTRAINT "FK_2ea7174f7a236c487a87519cecd"`
    );
    await queryRunner.query(
      `ALTER TABLE "event_location_snapshot" DROP CONSTRAINT "FK_add31260609e692adfad0b9be74"`
    );
    await queryRunner.query(
      `ALTER TABLE "event_location_snapshot" DROP CONSTRAINT "FK_4f20393293fadfccf31e054940e"`
    );
    await queryRunner.query(
      `ALTER TABLE "event_location_snapshot" DROP CONSTRAINT "FK_e68a054411f4d1905f3a55ba589"`
    );
    await queryRunner.query(
      `ALTER TABLE "event_location_snapshot" DROP CONSTRAINT "FK_f3d57722beca51915789c80e65d"`
    );
    await queryRunner.query(
      `ALTER TABLE "event_location_snapshot" DROP CONSTRAINT "FK_e23b3e2fe4cd4360c021bdf4e53"`
    );
    await queryRunner.query(
      `ALTER TABLE "discussion_comments" DROP CONSTRAINT "FK_31879a901b47e99141d2a7f0902"`
    );
    await queryRunner.query(
      `ALTER TABLE "discussion_comments" DROP CONSTRAINT "FK_0d66eb3bff3eb98f43ba63a3e6e"`
    );
    await queryRunner.query(
      `ALTER TABLE "discussion_comments" DROP CONSTRAINT "FK_ac4c145f6f5486650259beec5f9"`
    );
    await queryRunner.query(
      `ALTER TABLE "cities" DROP CONSTRAINT "FK_36b7590678c98e71c292f338399"`
    );
    await queryRunner.query(`DROP INDEX "public"."idx_users_city_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "notification_settings"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletion_requested_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "blocked_until"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "terms_accepted_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "onboarding_completed"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "social_links"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "languages"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "city_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "birth_date"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_photos_user_id"`);
    await queryRunner.query(`DROP TABLE "user_photos"`);
    await queryRunner.query(`DROP TABLE "user_interests"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_blocks_unique"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_blocks_blocked_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_blocks_blocker_id"`);
    await queryRunner.query(`DROP TABLE "user_blocks"`);
    await queryRunner.query(`DROP INDEX "public"."idx_notifications_is_read"`);
    await queryRunner.query(`DROP INDEX "public"."idx_notifications_recipient_id"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP INDEX "public"."idx_status_transitions_unique"`);
    await queryRunner.query(`DROP INDEX "public"."idx_status_transitions_lookup"`);
    await queryRunner.query(`DROP TABLE "status_transitions"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reports_object"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reports_moderator_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reports_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reports_reporter_id"`);
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_target"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_action"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_actor_id"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP INDEX "public"."idx_locations_created_by"`);
    await queryRunner.query(`DROP INDEX "public"."idx_locations_public_coordinates"`);
    await queryRunner.query(`DROP INDEX "public"."idx_locations_coordinates"`);
    await queryRunner.query(`DROP INDEX "public"."idx_locations_district_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_locations_city_id"`);
    await queryRunner.query(`DROP TABLE "locations"`);
    await queryRunner.query(`DROP INDEX "public"."idx_geocoding_cache_expires"`);
    await queryRunner.query(`DROP INDEX "public"."idx_geocoding_cache_coordinates"`);
    await queryRunner.query(`DROP INDEX "public"."idx_geocoding_cache_hash"`);
    await queryRunner.query(`DROP TABLE "geocoding_cache"`);
    await queryRunner.query(`DROP INDEX "public"."idx_districts_city_name"`);
    await queryRunner.query(`DROP INDEX "public"."idx_districts_boundary"`);
    await queryRunner.query(`DROP INDEX "public"."idx_districts_center"`);
    await queryRunner.query(`DROP INDEX "public"."idx_districts_city_id"`);
    await queryRunner.query(`DROP TABLE "districts"`);
    await queryRunner.query(`DROP INDEX "public"."idx_tags_name"`);
    await queryRunner.query(`DROP TABLE "tags"`);
    await queryRunner.query(`DROP INDEX "public"."idx_events_first_starts_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_events_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_events_primary_location_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_events_category_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_events_organizer_id"`);
    await queryRunner.query(`DROP TABLE "events"`);
    await queryRunner.query(`DROP TABLE "event_tags"`);
    await queryRunner.query(`DROP INDEX "public"."idx_event_reviews_unique_pair"`);
    await queryRunner.query(`DROP INDEX "public"."idx_event_reviews_author_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_event_reviews_event_id"`);
    await queryRunner.query(`DROP TABLE "event_reviews"`);
    await queryRunner.query(`DROP INDEX "public"."idx_participations_unique_pair"`);
    await queryRunner.query(`DROP INDEX "public"."idx_participations_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_participations_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_participations_event_id"`);
    await queryRunner.query(`DROP TABLE "event_participations"`);
    await queryRunner.query(`DROP INDEX "public"."idx_event_occurrence_unique_slot"`);
    await queryRunner.query(`DROP INDEX "public"."idx_event_occurrences_starts_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_event_occurrences_location_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_event_occurrences_event_id"`);
    await queryRunner.query(`DROP TABLE "event_occurrences"`);
    await queryRunner.query(`DROP INDEX "public"."idx_event_location_snapshot_public_coordinates"`);
    await queryRunner.query(`DROP INDEX "public"."idx_event_location_snapshot_coordinates"`);
    await queryRunner.query(`DROP INDEX "public"."idx_event_location_snapshot_district_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_event_location_snapshot_city_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_event_location_snapshot_location_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_event_location_snapshot_event_id"`);
    await queryRunner.query(`DROP TABLE "event_location_snapshot"`);
    await queryRunner.query(`DROP INDEX "public"."idx_discussion_comments_parent_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_discussion_comments_author_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_discussion_comments_event_id"`);
    await queryRunner.query(`DROP TABLE "discussion_comments"`);
    await queryRunner.query(`DROP TABLE "interests"`);
    await queryRunner.query(`DROP INDEX "public"."idx_cities_bbox"`);
    await queryRunner.query(`DROP TABLE "cities"`);
    await queryRunner.query(`DROP TABLE "countries"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_users_email" ON "users" USING btree ("email") `
    );
  }
}
