import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  UserBlockEntity,
  UserEntity,
  UserInterestEntity,
  UserPhotoEntity
} from '../../../src/modules/users/infrastructure/index.js';
import {
  PasswordCredentialEntity,
  GoogleCredentialEntity,
  PasskeyCredentialEntity,
  PasskeyChallengeEntity,
  EmailVerificationTokenEntity,
  PasswordResetTokenEntity,
  RefreshSessionEntity,
  SecurityEventEntity
} from '../../../src/modules/auth/infrastructure/index.js';
import {
  CategoryEntity,
  CityEntity,
  CountryEntity,
  InterestEntity
} from '../../../src/modules/dictionaries/infrastructure/index.js';
import {
  DiscussionCommentEntity,
  EventLocationSnapshotEntity,
  EventOccurrenceEntity,
  EventParticipationEntity,
  EventReviewEntity,
  EventTagEntity,
  EventEntity,
  TagEntity
} from '../../../src/modules/events/infrastructure/index.js';
import {
  DistrictEntity,
  GeocodingCacheEntity,
  LocationEntity
} from '../../../src/modules/geolocation/infrastructure/index.js';
import {
  AuditLogEntity,
  ReportEntity,
  StatusTransitionEntity
} from '../../../src/modules/moderation/infrastructure/index.js';
import { NotificationEntity } from '../../../src/modules/notifications/infrastructure/index.js';
import { OnboardingStateEntity } from '../../../src/modules/onboarding/infrastructure/index.js';

import { InitialSchema1794056977895 } from '../../../src/db/migrations/1794056977895-InitialSchema.js';
import { FullSchema1794817225368 } from '../../../src/db/migrations/1794817225368-FullSchema.js';
import { SeedDictionaries1794817300000 } from '../../../src/db/migrations/1794817300000-SeedDictionaries.js';
import { AddOnboardingSchema1794923437553 } from '../../../src/db/migrations/1794923437553-AddOnboardingSchema.js';


export const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://lokua:lokua@localhost:5433/lokua_test';

export function createTestDataSource(url: string = TEST_DATABASE_URL): DataSource {
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, '');

  if (dbName === 'lokua' && !process.env.ALLOW_UNSAFE_TEST_DB) {
    throw new Error(
        `Refusing to run integration tests against '${dbName}'. Test database must be separate (e.g. lokua_test).`
    );
  }

  return new DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    logging: false,

    entities: [
      UserEntity,
      UserBlockEntity,
      UserInterestEntity,
      UserPhotoEntity,

      PasswordCredentialEntity,
      GoogleCredentialEntity,
      PasskeyCredentialEntity,
      PasskeyChallengeEntity,
      EmailVerificationTokenEntity,
      PasswordResetTokenEntity,
      RefreshSessionEntity,
      SecurityEventEntity,

      CategoryEntity,
      CityEntity,
      CountryEntity,
      InterestEntity,

      DiscussionCommentEntity,
      EventLocationSnapshotEntity,
      EventOccurrenceEntity,
      EventParticipationEntity,
      EventReviewEntity,
      EventTagEntity,
      EventEntity,
      TagEntity,

      DistrictEntity,
      GeocodingCacheEntity,
      LocationEntity,

      AuditLogEntity,
      ReportEntity,
      StatusTransitionEntity,

      NotificationEntity,
      OnboardingStateEntity
    ],
    migrations: [
      InitialSchema1794056977895,
      FullSchema1794817225368,
      SeedDictionaries1794817300000,
      AddOnboardingSchema1794923437553
    ]
  });
}

export async function isDatabaseReachable(dataSource: DataSource): Promise<boolean> {
  try {
    await dataSource.initialize();
    await dataSource.destroy();
    return true;
  } catch {
    return false;
  }
}

export async function clearAllTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    TRUNCATE TABLE
      "security_events",
      "refresh_sessions",
      "password_reset_tokens",
      "email_verification_tokens",
      "passkey_challenges",
      "passkey_credentials",
      "password_credentials",
      "google_credentials",
      "users"
    CASCADE;
  `);
}