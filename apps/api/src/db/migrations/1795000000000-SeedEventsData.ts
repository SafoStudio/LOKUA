import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { MigrationInterface, QueryRunner } from 'typeorm';

type UserRole = 'USER' | 'MODERATOR' | 'ADMIN';
type EventFormat = 'OFFLINE' | 'ONLINE';
type AgeRestriction = 'ALL' | 'SIXTEEN_PLUS' | 'EIGHTEEN_PLUS';
type ParticipationMode = 'FREE' | 'REQUEST';

interface SeedUser {
  key: string;
  email: string;
  name: string;
  role: UserRole;
  birthDate: string;
  citySlug: string;
}

interface SeedEvent {
  title: string;
  description: string;
  categorySlug: string;
  citySlug: string;
  format: EventFormat;
}

interface CategoryRow {
  id: string;
  slug: string;
}

interface CityRow {
  id: string;
  slug: string;
  name: string;
  latitude: string | number;
  longitude: string | number;
}

const DEMO_PASSWORD = 'LokuaDemo2026!';
const BCRYPT_SALT_ROUNDS = 12;

const TEST_USERS: SeedUser[] = [
  {
    key: 'admin',
    email: 'admin@lokua.test',
    name: 'Адміністратор LOKUA',
    role: 'ADMIN',
    birthDate: '1990-04-15',
    citySlug: 'kyiv'
  },
  {
    key: 'moderator',
    email: 'moderator@lokua.test',
    name: 'Модератор LOKUA',
    role: 'MODERATOR',
    birthDate: '1993-08-21',
    citySlug: 'kyiv'
  },
  {
    key: 'user',
    email: 'user@lokua.test',
    name: 'Користувач LOKUA',
    role: 'USER',
    birthDate: '1995-02-10',
    citySlug: 'kyiv'
  }
];

const TEST_EVENTS: SeedEvent[] = [
  {
    title: 'Ранкова пробіжка в парку',
    description:
      'Легка спільна пробіжка для будь-якого рівня підготовки. Знайомимося, розминаємося та починаємо день із руху.',
    categorySlug: 'sport',
    citySlug: 'kyiv',
    format: 'OFFLINE'
  },
  {
    title: 'Вечір настільних ігор',
    description:
      'Граємо в сучасні настільні ігри, знайомимося з новими людьми та приємно проводимо час.',
    categorySlug: 'board-games',
    citySlug: 'kyiv',
    format: 'OFFLINE'
  },
  {
    title: 'Frontend Community Meetup',
    description:
      'Обговорюємо сучасні підходи до frontend-розробки, ділимося досвідом та знайомимося з розробниками.',
    categorySlug: 'it',
    citySlug: 'kyiv',
    format: 'ONLINE'
  },
  {
    title: 'Акустичний музичний вечір',
    description:
      'Невелика музична зустріч із живими виступами. Можна прийти послухати або виступити самостійно.',
    categorySlug: 'music',
    citySlug: 'lviv',
    format: 'OFFLINE'
  },
  {
    title: 'Майстерня кераміки',
    description: 'Знайомимося з основами роботи з глиною та створюємо власні невеликі вироби.',
    categorySlug: 'art',
    citySlug: 'kyiv',
    format: 'OFFLINE'
  },
  {
    title: 'Англійський розмовний клуб',
    description:
      'Практикуємо розмовну англійську в дружній атмосфері. Рівень володіння мовою не має значення.',
    categorySlug: 'education',
    citySlug: 'odesa',
    format: 'OFFLINE'
  },
  {
    title: 'Зустріч поціновувачів кави',
    description: 'Пробуємо різні способи приготування кави та обговорюємо улюблені сорти.',
    categorySlug: 'food',
    citySlug: 'odesa',
    format: 'OFFLINE'
  },
  {
    title: 'Startup Talks',
    description:
      'Обговорюємо запуск продуктів, перші продажі, помилки початківців та розвиток стартапів.',
    categorySlug: 'it',
    citySlug: 'dnipro',
    format: 'ONLINE'
  },
  {
    title: 'Шаховий клуб',
    description:
      'Граємо в шахи, розбираємо цікаві партії та спілкуємося. Запрошуємо початківців і досвідчених гравців.',
    categorySlug: 'board-games',
    citySlug: 'kharkiv',
    format: 'OFFLINE'
  },
  {
    title: 'Книжковий клуб',
    description: 'Обговорюємо прочитані книги, ділимося рекомендаціями та обираємо наступний твір.',
    categorySlug: 'education',
    citySlug: 'lviv',
    format: 'OFFLINE'
  },
  {
    title: 'Вечір джазу',
    description:
      'Зустрічаємося, щоб послухати джаз, познайомитися з музикантами та поговорити про музику.',
    categorySlug: 'music',
    citySlug: 'odesa',
    format: 'OFFLINE'
  },
  {
    title: 'Основи UX/UI дизайну',
    description:
      'Розглядаємо основи проєктування інтерфейсів, користувацькі сценарії та практичні приклади.',
    categorySlug: 'it',
    citySlug: 'kyiv',
    format: 'ONLINE'
  },
  {
    title: 'Кулінарний майстер-клас',
    description: 'Готуємо прості страви разом, обмінюємося рецептами та смакуємо результат.',
    categorySlug: 'food',
    citySlug: 'kyiv',
    format: 'OFFLINE'
  },
  {
    title: 'Бадмінтон для початківців',
    description: 'Граємо в бадмінтон у комфортному темпі. Ракетки та волани надають організатори.',
    categorySlug: 'sport',
    citySlug: 'kharkiv',
    format: 'OFFLINE'
  },
  {
    title: 'Фотопрогулянка містом',
    description: 'Шукаємо цікаві міські сюжети, практикуємо композицію та ділимося фотографіями.',
    categorySlug: 'art',
    citySlug: 'odesa',
    format: 'OFFLINE'
  },
  {
    title: 'Вечір інтелектуальних ігор',
    description:
      'Командна вікторина на різноманітні теми. Не обов’язково знати все — головне брати участь.',
    categorySlug: 'other',
    citySlug: 'dnipro',
    format: 'OFFLINE'
  },
  {
    title: 'Настільні ігри: велика зустріч',
    description: 'Знайомимося з новими іграми та збираємо компанії для партій різної складності.',
    categorySlug: 'board-games',
    citySlug: 'kyiv',
    format: 'OFFLINE'
  },
  {
    title: 'Digital Product Workshop',
    description:
      'Практична зустріч про створення цифрових продуктів: від ідеї до перших користувачів.',
    categorySlug: 'it',
    citySlug: 'lviv',
    format: 'ONLINE'
  },
  {
    title: 'Міський скетчинг',
    description:
      'Малюємо міські об’єкти й архітектуру. Можна прийти з будь-якими матеріалами для малювання.',
    categorySlug: 'art',
    citySlug: 'cherkasy',
    format: 'OFFLINE'
  },
  {
    title: 'Історія нашого міста',
    description: 'Обговорюємо історію міста, цікаві місця та маловідомі історичні факти.',
    categorySlug: 'education',
    citySlug: 'kharkiv',
    format: 'OFFLINE'
  },
  {
    title: 'Music Production Meetup',
    description:
      'Обговорюємо створення музики, домашні студії, обладнання та програмне забезпечення.',
    categorySlug: 'music',
    citySlug: 'kyiv',
    format: 'ONLINE'
  },
  {
    title: 'Бранч і нові знайомства',
    description: 'Неформальна зустріч за сніданком для спілкування та знайомства з новими людьми.',
    categorySlug: 'food',
    citySlug: 'lviv',
    format: 'OFFLINE'
  },
  {
    title: 'Танцювальне тренування',
    description:
      'Знайомимося з базовими рухами та танцюємо в комфортному темпі. Попередній досвід не потрібен.',
    categorySlug: 'sport',
    citySlug: 'odesa',
    format: 'OFFLINE'
  },
  {
    title: 'Практика публічних виступів',
    description:
      'Вчимося структурувати думки, виступати перед аудиторією та отримувати конструктивний зворотний зв’язок.',
    categorySlug: 'education',
    citySlug: 'dnipro',
    format: 'ONLINE'
  },
  {
    title: 'Міська волонтерська зустріч',
    description: 'Знайомимося з локальними ініціативами та обговорюємо, як зробити місто кращим.',
    categorySlug: 'other',
    citySlug: 'kyiv',
    format: 'OFFLINE'
  },
  {
    title: 'Data Community Meetup',
    description:
      'Обговорюємо роботу з даними, аналітику, бази даних та практичні інженерні завдання.',
    categorySlug: 'it',
    citySlug: 'kharkiv',
    format: 'ONLINE'
  },
  {
    title: 'Майстерня ілюстрації',
    description:
      'Експериментуємо з формами та кольорами, створюємо невеликі ілюстрації й обмінюємося ідеями.',
    categorySlug: 'art',
    citySlug: 'dnipro',
    format: 'OFFLINE'
  },
  {
    title: 'Велопрогулянка містом',
    description: 'Спільна прогулянка на велосипедах спокійним міським маршрутом.',
    categorySlug: 'sport',
    citySlug: 'kyiv',
    format: 'OFFLINE'
  },
  {
    title: 'Community Dinner',
    description:
      'Спільна вечеря, знайомство з новими людьми та приємне спілкування за одним столом.',
    categorySlug: 'food',
    citySlug: 'odesa',
    format: 'OFFLINE'
  },
  {
    title: 'Основи фотографії',
    description: 'Обговорюємо налаштування камери, світло, композицію та практичні прийоми зйомки.',
    categorySlug: 'art',
    citySlug: 'lviv',
    format: 'ONLINE'
  },
  {
    title: 'Зустріч розробників',
    description: 'Спілкуємося про backend-розробку, архітектуру застосунків та інженерні практики.',
    categorySlug: 'it',
    citySlug: 'kyiv',
    format: 'ONLINE'
  },
  {
    title: 'Йога для початківців',
    description:
      'Спокійна практика для відновлення рухливості, розслаблення та знайомства з йогою.',
    categorySlug: 'sport',
    citySlug: 'cherkasy',
    format: 'OFFLINE'
  },
  {
    title: 'Вечір творчих знайомств',
    description: 'Знайомимося з людьми творчих професій, ділимося проєктами та ідеями.',
    categorySlug: 'other',
    citySlug: 'kharkiv',
    format: 'OFFLINE'
  }
];

function createSeedUuid(value: string): string {
  const hex = createHash('md5').update(`lokua-demo:${value}`).digest('hex').split('');

  hex[12] = '3';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x03) | 0x08).toString(16);

  const valueHex = hex.join('');

  return [
    valueHex.slice(0, 8),
    valueHex.slice(8, 12),
    valueHex.slice(12, 16),
    valueHex.slice(16, 20),
    valueHex.slice(20, 32)
  ].join('-');
}

function roundCoordinate(value: number, precision: number): number {
  return Number(value.toFixed(precision));
}

export class SeedEventsData1795000000000 implements MigrationInterface {
  name = 'SeedEventsData1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    if (TEST_EVENTS.length !== 33) {
      throw new Error('Очікується рівно 33 демоподії');
    }

    const existingUsers = (await queryRunner.query(
      `SELECT email FROM users WHERE email = ANY($1::varchar[])`,
      [TEST_USERS.map((user) => user.email)]
    )) as Array<{ email: string }>;

    if (existingUsers.length > 0) {
      throw new Error(
        `Тестові користувачі вже існують: ${existingUsers.map((user) => user.email).join(', ')}`
      );
    }

    const citySlugs = [...new Set(TEST_USERS.map((user) => user.citySlug))];
    const eventCitySlugs = [...new Set(TEST_EVENTS.map((event) => event.citySlug))];
    const requiredCitySlugs = [...new Set([...citySlugs, ...eventCitySlugs])];

    const categorySlugs = [...new Set(TEST_EVENTS.map((event) => event.categorySlug))];

    const categories = (await queryRunner.query(
      `SELECT id, slug FROM categories WHERE slug = ANY($1::varchar[])`,
      [categorySlugs]
    )) as CategoryRow[];

    const cities = (await queryRunner.query(
      `SELECT id, slug, name, latitude, longitude
       FROM cities
       WHERE slug = ANY($1::varchar[])`,
      [requiredCitySlugs]
    )) as CityRow[];

    const categoryMap = new Map(categories.map((category) => [category.slug, category.id]));

    const cityMap = new Map(cities.map((city) => [city.slug, city]));

    for (const slug of categorySlugs) {
      if (!categoryMap.has(slug)) {
        throw new Error(`Не знайдено обов'язкову категорію: ${slug}`);
      }
    }

    for (const slug of requiredCitySlugs) {
      if (!cityMap.has(slug)) {
        throw new Error(`Не знайдено обов'язкове місто: ${slug}`);
      }
    }

    // Один bcrypt-хеш створюється для всіх демо-користувачів.
    // Cost factor відповідає BcryptPasswordHasher у модулі авторизації.
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_SALT_ROUNDS);

    const userIds = new Map<string, string>();
    const now = new Date();

    for (const user of TEST_USERS) {
      const id = createSeedUuid(`user-${user.key}`);
      const city = cityMap.get(user.citySlug)!;

      await queryRunner.query(
        `INSERT INTO users (
          id,
          email,
          name,
          email_verified,
          birth_date,
          role,
          status,
          city_id,
          bio,
          languages,
          onboarding_completed,
          terms_accepted_at,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, true, $4, $5, 'ACTIVE', $6,
          $7, ARRAY['uk', 'en']::text[], true, $8, $8, $8
        )`,
        [
          id,
          user.email,
          user.name,
          user.birthDate,
          user.role,
          city.id,
          'Тестовий обліковий запис для розробки LOKUA',
          now
        ]
      );

      await queryRunner.query(
        `INSERT INTO password_credentials (
          id,
          user_id,
          password_hash,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $4)`,
        [createSeedUuid(`password-${user.key}`), id, passwordHash, now]
      );

      userIds.set(user.key, id);
    }

    const organizerId = userIds.get('user')!;
    const adminId = userIds.get('admin')!;

    for (let index = 0; index < TEST_EVENTS.length; index++) {
      const seed = TEST_EVENTS[index];
      const eventNumber = index + 1;
      const eventId = createSeedUuid(`event-${eventNumber}`);

      const categoryId = categoryMap.get(seed.categorySlug)!;
      const city = cityMap.get(seed.citySlug)!;

      const isOffline = seed.format === 'OFFLINE';
      const locationId = isOffline ? createSeedUuid(`location-${eventNumber}`) : null;

      const startsAt =
        index < 26
          ? new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() + Math.floor(index / 3) + 1,
                16,
                0,
                0
              )
            )
          : null;

      const endsAt = startsAt ? new Date(startsAt.getTime() + 2 * 60 * 60 * 1000) : null;

      const hideExactAddress = isOffline && eventNumber % 2 === 0;
      const capacityLimit = eventNumber % 4 === 0 ? null : 12 + (eventNumber % 5) * 6;

      const participationMode: ParticipationMode = eventNumber % 3 === 0 ? 'REQUEST' : 'FREE';

      const isFree = eventNumber % 5 !== 0;

      const ageRestriction: AgeRestriction =
        eventNumber % 11 === 0 ? 'EIGHTEEN_PLUS' : eventNumber % 4 === 0 ? 'SIXTEEN_PLUS' : 'ALL';

      const coordinates =
        isOffline && locationId
          ? (() => {
              const baseLatitude = Number(city.latitude);
              const baseLongitude = Number(city.longitude);

              if (!Number.isFinite(baseLatitude) || !Number.isFinite(baseLongitude)) {
                throw new Error(`Некоректні координати міста: ${city.slug}`);
              }

              const exactLatitude = roundCoordinate(
                baseLatitude + ((eventNumber % 5) - 2) * 0.003,
                6
              );

              const exactLongitude = roundCoordinate(
                baseLongitude + ((eventNumber % 7) - 3) * 0.004,
                6
              );

              return {
                exactLatitude,
                exactLongitude,
                publicLatitude: hideExactAddress
                  ? roundCoordinate(exactLatitude, 2)
                  : exactLatitude,
                publicLongitude: hideExactAddress
                  ? roundCoordinate(exactLongitude, 2)
                  : exactLongitude
              };
            })()
          : {
              exactLatitude: null,
              exactLongitude: null,
              publicLatitude: null,
              publicLongitude: null
            };

      const { exactLatitude, exactLongitude, publicLatitude, publicLongitude } = coordinates;

      if (isOffline && locationId) {
        const locationName = `Демо-локація LOKUA №${String(eventNumber).padStart(2, '0')}`;
        const locationAddress = `Демо-адреса, м. ${city.name}, Україна`;

        await queryRunner.query(
          `INSERT INTO locations (
      id,
      name,
      address,
      city_id,
      district_id,
      country_code,
      coordinates,
      public_coordinates,
      provider,
      provider_place_id,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, NULL, 'UA',
      ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
      ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
      'manual', NULL, $9, $10, $10
    )`,
          [
            locationId,
            locationName,
            locationAddress,
            city.id,
            exactLongitude,
            exactLatitude,
            publicLongitude,
            publicLatitude,
            adminId,
            now
          ]
        );
      }

      const onlineUrl = isOffline ? null : `https://example.com/lokua-demo-event-${eventNumber}`;

      await queryRunner.query(
        `INSERT INTO events (
          id,
          organizer_id,
          title,
          category_id,
          description,
          cover_url,
          media_urls,
          format,
          primary_location_id,
          online_url,
          hide_exact_address,
          capacity_limit,
          participation_mode,
          age_restriction,
          is_free,
          price_text,
          items_to_bring,
          status,
          cancellation_reason,
          is_hidden_by_admin,
          first_starts_at,
          first_ends_at,
          timezone,
          published_at,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, NULL, '[]'::jsonb,
          $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, 'PUBLISHED', NULL, false, $16, $17,
          'Europe/Kyiv', $18, $18, $18
        )`,
        [
          eventId,
          organizerId,
          seed.title,
          categoryId,
          seed.description,
          seed.format,
          locationId,
          onlineUrl,
          hideExactAddress,
          capacityLimit,
          participationMode,
          ageRestriction,
          isFree,
          isFree ? null : '200 грн',
          isOffline ? 'Гарний настрій' : null,
          startsAt,
          endsAt,
          now
        ]
      );

      if (isOffline && locationId) {
        await queryRunner.query(
          `INSERT INTO event_location_snapshot (
            event_id,
            location_id,
            city_id,
            district_id,
            country_code,
            name,
            address,
            coordinates,
            public_coordinates,
            snapshot_at
          )
          SELECT
            $1,
            l.id,
            l.city_id,
            l.district_id,
            l.country_code,
            l.name,
            l.address,
            l.coordinates,
            l.public_coordinates,
            $2
          FROM locations l
          WHERE l.id = $3`,
          [eventId, now, locationId]
        );
      }

      if (startsAt && endsAt) {
        await queryRunner.query(
          `INSERT INTO event_occurrences (
            event_id,
            location_id,
            starts_at,
            ends_at,
            timezone,
            status,
            is_overridden,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, 'Europe/Kyiv',
            'SCHEDULED', false, $5, $5
          )`,
          [eventId, locationId, startsAt, endsAt, now]
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    const eventIds = TEST_EVENTS.map((_, index) => createSeedUuid(`event-${index + 1}`));

    const locationIds = TEST_EVENTS.flatMap((event, index) =>
      event.format === 'OFFLINE' ? [createSeedUuid(`location-${index + 1}`)] : []
    );

    const userIds = TEST_USERS.map((user) => createSeedUuid(`user-${user.key}`));

    await queryRunner.query(`DELETE FROM events WHERE id = ANY($1::uuid[])`, [eventIds]);

    await queryRunner.query(`DELETE FROM locations WHERE id = ANY($1::uuid[])`, [locationIds]);

    await queryRunner.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]);
  }
}
