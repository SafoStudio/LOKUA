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
  DiscussionCommentQuotaEntity,
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
import { HardenAuthSessions1795784659656 } from '../../../src/db/migrations/1795784659656-HardenAuthSessions.js';
import { QueueDeletedAccountMedia1795784659657 } from '../../../src/db/migrations/1795784659657-QueueDeletedAccountMedia.js';
import { FullSchema1794817225368 } from '../../../src/db/migrations/1794817225368-FullSchema.js';
import { SeedDictionaries1794817300000 } from '../../../src/db/migrations/1794817300000-SeedDictionaries.js';
import { AddOnboardingSchema1794923437553 } from '../../../src/db/migrations/1794923437553-AddOnboardingSchema.js';


import { SeedEventsData1795000000000 } from '../../../src/db/migrations/1795000000000-SeedEventsData.js';

import { TrackApprovedEventParticipants1795010000000 } from '../../../src/db/migrations/1795010000000-TrackApprovedEventParticipants.js';
import { AddDiscussionCommentQuotas1795020000000 } from '../../../src/db/migrations/1795020000000-AddDiscussionCommentQuotas.js';
import { AddNotificationDelivery1795030000000 } from '../../../src/db/migrations/1795030000000-AddNotificationDelivery.js';
import { SeedKyivDistricts1795040000000 } from '../../../src/db/migrations/1795040000000-SeedKyivDistricts.js';
import { TrackParticipationEntryMode1795784659655 } from '../../../src/db/migrations/1795784659655-TrackParticipationEntryMode.js';

export const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://lokua:lokua@localhost:5433/lokua_test';

export function createTestDataSource(url: string = TEST_DATABASE_URL): DataSource {
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, '');

  if (dbName !== 'lokua_test' || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error(
        'Integration tests require a loopback connection to the dedicated lokua_test database.'
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
      DiscussionCommentQuotaEntity,
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
      AddOnboardingSchema1794923437553,
      SeedEventsData1795000000000,
      TrackApprovedEventParticipants1795010000000,
      AddDiscussionCommentQuotas1795020000000,
      AddNotificationDelivery1795030000000,
      SeedKyivDistricts1795040000000,
      TrackParticipationEntryMode1795784659655,
      HardenAuthSessions1795784659656,
      QueueDeletedAccountMedia1795784659657
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
      "auth_rate_limits",
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
