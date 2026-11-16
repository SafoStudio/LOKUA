import type { DataSource } from 'typeorm';
import { createDictionariesModule } from '../modules/dictionaries/index.js';
import { createUsersModule } from '../modules/users/index.js';
import { createAuthModule } from '../modules/auth/index.js';
import { createStorageModule } from '../modules/storage/index.js';
import { createGeolocationModule } from '../modules/geolocation/index.js';
import { createEventsModule } from '../modules/events/index.js';
import { createModerationModule } from '../modules/moderation/index.js';
import { createNotificationsModule } from '../modules/notifications/index.js';

export function createModules(dataSource: DataSource) {
  const dictionariesModule = createDictionariesModule({ dataSource });
  const usersModule = createUsersModule({ dataSource });

  const authModule = createAuthModule({
    dataSource,
    users: usersModule.authUsers
  });

  const storageModule = createStorageModule();

  const geolocationModule = createGeolocationModule({
    dataSource,
    cities: dictionariesModule.cities,
    countries: dictionariesModule.countries,
    users: usersModule.users
  });

  const eventsModule = createEventsModule({ dataSource });
  const moderationModule = createModerationModule({ dataSource });
  const notificationsModule = createNotificationsModule({ dataSource });

  return {
    dictionaries: dictionariesModule,
    users: usersModule,
    auth: authModule,
    storage: storageModule,
    geolocation: geolocationModule,
    events: eventsModule,
    moderation: moderationModule,
    notifications: notificationsModule
  };
}
