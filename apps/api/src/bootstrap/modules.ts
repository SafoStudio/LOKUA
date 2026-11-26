import type { DataSource } from 'typeorm';
import { createDictionariesModule } from '../modules/dictionaries/index.js';
import { createProfilePhotosRouter, createUsersModule } from '../modules/users/index.js';
import { createAuthModule } from '../modules/auth/index.js';
import { createStorageModule } from '../modules/storage/index.js';
import { createGeolocationModule } from '../modules/geolocation/index.js';
import { createEventsModule } from '../modules/events/index.js';
import { createModerationModule } from '../modules/moderation/index.js';
import { createNotificationsModule } from '../modules/notifications/index.js';
import { createOnboardingModule } from '../modules/onboarding/index.js';

export function createModules(dataSource: DataSource) {
  const dictionariesModule = createDictionariesModule({ dataSource });
  const usersModule = createUsersModule({ dataSource });

  const authModule = createAuthModule({
    dataSource,
    users: usersModule.authUsers,
    access: usersModule.access,
    profiles: usersModule.profiles
  });

  const storageModule = createStorageModule();
  const imageMedia = storageModule.createImageMedia(authModule.requireAuth);
  const profilePhotosRouter = createProfilePhotosRouter(
    authModule.requireAuth,
    usersModule.photos,
    imageMedia.images
  );

  const notificationsModule = createNotificationsModule({
    dataSource,
    requireAuth: authModule.requireAuth,
    sendEmail: authModule.sendNotificationEmail
  });

  const moderationModule = createModerationModule({
    dataSource,
    users: usersModule.users,
    access: usersModule.access,
    blocks: usersModule.blocks,
    notifications: notificationsModule.publisher,
    requireAuth: authModule.requireAuth,
    requireRole: authModule.requireRole
  });

  const onboardingModule = createOnboardingModule({
    dataSource,
    users: usersModule.users,
    onboardingUsers: usersModule.onboarding,
    cities: dictionariesModule.cities,
    interests: dictionariesModule.interests,
    audit: moderationModule.audit,
    requireAuth: authModule.requireAuth,
    images: imageMedia.images
  });

  const geolocationModule = createGeolocationModule({
    dataSource,
    cities: dictionariesModule.cities,
    countries: dictionariesModule.countries,
    users: usersModule.users,
    requireAuth: authModule.requireAuth
  });

  const eventsModule = createEventsModule({
    cities: dictionariesModule.cities,
    profiles: usersModule.profiles,
    blocks: usersModule.blocks,
    authUsers: usersModule.authUsers,
    categories: dictionariesModule.categories,
    locations: geolocationModule.locations,
    dataSource,
    access: usersModule.access,
    optionalAuth: authModule.optionalAuth,
    requireAuth: authModule.requireAuth,
    notifications: notificationsModule.publisher,
    images: imageMedia.images
  });

  return {
    dictionaries: dictionariesModule,
    users: usersModule,
    auth: authModule,
    storage: { ...storageModule, imageMediaRouter: imageMedia.router },
    profilePhotosRouter,
    moderation: moderationModule,
    onboarding: onboardingModule,
    geolocation: geolocationModule,
    events: eventsModule,
    notifications: notificationsModule
  };
}
