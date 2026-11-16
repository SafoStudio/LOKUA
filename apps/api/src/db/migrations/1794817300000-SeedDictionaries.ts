import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDictionaries1794817300000 implements MigrationInterface {
  name = 'SeedDictionaries1794817300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);

    await queryRunner.query(`
      INSERT INTO "countries" ("code", "name") VALUES
        ('UA', 'Україна')
      ON CONFLICT ("code") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "cities" (
        "country_code", "name", "slug", "latitude", "longitude", "timezone", "is_active", "bbox"
      ) VALUES
        ('UA', 'Київ', 'kyiv', 50.4501, 30.5234, 'Europe/Kyiv', true,
          ST_MakeEnvelope(30.2394, 50.2133, 30.8256, 50.5908, 4326)::geography),
        ('UA', 'Львів', 'lviv', 49.8397, 24.0297, 'Europe/Kyiv', true,
          ST_MakeEnvelope(23.8561, 49.7368, 24.1600, 49.9188, 4326)::geography),
        ('UA', 'Одеса', 'odesa', 46.4825, 30.7233, 'Europe/Kyiv', true,
          ST_MakeEnvelope(30.5529, 46.3522, 30.8563, 46.6257, 4326)::geography),
        ('UA', 'Харків', 'kharkiv', 49.9935, 36.2304, 'Europe/Kyiv', true,
          ST_MakeEnvelope(36.0514, 49.8741, 36.4152, 50.0968, 4326)::geography),
        ('UA', 'Дніпро', 'dnipro', 48.4647, 35.0462, 'Europe/Kyiv', true,
          ST_MakeEnvelope(34.8452, 48.3348, 35.2547, 48.5816, 4326)::geography),
        ('UA', 'Черкаси', 'cherkasy', 49.4444, 32.0598, 'Europe/Kyiv', true,
          ST_MakeEnvelope(31.8852, 49.3482, 32.2318, 49.5431, 4326)::geography)
      ON CONFLICT ("country_code", "slug") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "categories" ("name", "slug", "icon", "order_num", "is_active") VALUES
        ('Спорт', 'sport', '🏃', 1, true),
        ('Музика', 'music', '🎵', 2, true),
        ('Настільні ігри', 'board-games', '🎲', 3, true),
        ('Мистецтво', 'art', '🎨', 4, true),
        ('IT', 'it', '💻', 5, true),
        ('Освіта', 'education', '📚', 6, true),
        ('Їжа', 'food', '🍕', 7, true),
        ('Інше', 'other', '✨', 8, true)
      ON CONFLICT ("slug") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "interests" ("name", "is_active") VALUES
        ('Біг', true),
        ('Настільні ігри', true),
        ('Скетчинг', true),
        ('Кава', true),
        ('Концерти', true),
        ('Кіно', true),
        ('Книги', true),
        ('Подорожі', true),
        ('Фотографія', true),
        ('Йога', true),
        ('Велосипед', true),
        ('Плавання', true),
        ('Танці', true),
        ('Кулінарія', true),
        ('Волонтерство', true)
      ON CONFLICT ("name") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "status_transitions" ("entity_type", "from_status", "to_status") VALUES
        ('EVENT', 'DRAFT', 'PUBLISHED'),
        ('EVENT', 'DRAFT', 'CANCELLED'),
        ('EVENT', 'PUBLISHED', 'FULL'),
        ('EVENT', 'PUBLISHED', 'COMPLETED'),
        ('EVENT', 'PUBLISHED', 'CANCELLED'),
        ('EVENT', 'FULL', 'PUBLISHED'),
        ('EVENT', 'FULL', 'COMPLETED'),
        ('EVENT', 'FULL', 'CANCELLED'),
        ('PARTICIPATION', 'PENDING', 'APPROVED'),
        ('PARTICIPATION', 'PENDING', 'REJECTED'),
        ('PARTICIPATION', 'PENDING', 'NOT_CONSIDERED'),
        ('PARTICIPATION', 'PENDING', 'CANCELLED_BY_USER'),
        ('PARTICIPATION', 'APPROVED', 'CANCELLED_BY_USER'),
        ('PARTICIPATION', 'APPROVED', 'REMOVED_BY_ORGANIZER'),
        ('REPORT', 'NEW', 'IN_PROGRESS'),
        ('REPORT', 'NEW', 'REJECTED'),
        ('REPORT', 'IN_PROGRESS', 'RESOLVED'),
        ('REPORT', 'IN_PROGRESS', 'REJECTED'),
        ('ACCOUNT', 'ACTIVE', 'BLOCKED_TEMPORARY'),
        ('ACCOUNT', 'ACTIVE', 'BLOCKED_PERMANENT'),
        ('ACCOUNT', 'ACTIVE', 'PENDING_DELETION'),
        ('ACCOUNT', 'BLOCKED_TEMPORARY', 'ACTIVE'),
        ('ACCOUNT', 'BLOCKED_PERMANENT', 'ACTIVE'),
        ('ACCOUNT', 'PENDING_DELETION', 'ACTIVE'),
        ('ACCOUNT', 'PENDING_DELETION', 'DELETED')
      ON CONFLICT ("entity_type", "from_status", "to_status") DO NOTHING
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
