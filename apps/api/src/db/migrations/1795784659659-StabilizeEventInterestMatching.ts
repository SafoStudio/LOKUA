import type { MigrationInterface, QueryRunner } from 'typeorm';

const tables = ['categories', 'interests', 'tags'] as const;

export class StabilizeEventInterestMatching1795784659659 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION set_event_interest_feed_key() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          NEW.feed_key := lower(btrim(NEW.name));
          RETURN NEW;
        END;
      $$
    `);

    for (const table of tables) {
      await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN feed_key text`);
      await queryRunner.query(`UPDATE ${table} SET feed_key = lower(btrim(name))`);
      await queryRunner.query(`ALTER TABLE ${table} ALTER COLUMN feed_key SET NOT NULL`);
      await queryRunner.query(`
        CREATE TRIGGER set_event_interest_feed_key
        BEFORE INSERT ON ${table}
        FOR EACH ROW EXECUTE FUNCTION set_event_interest_feed_key()
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of tables) {
      await queryRunner.query(`DROP TRIGGER set_event_interest_feed_key ON ${table}`);
      await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN feed_key`);
    }
    await queryRunner.query('DROP FUNCTION set_event_interest_feed_key()');
  }
}
