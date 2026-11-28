import { randomUUID } from 'node:crypto';
import express from 'express';
import type { RequestHandler } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppError, TypeOrmUnitOfWork } from '../../src/common/index.js';
import { errorHandler } from '../../src/middlewares/index.js';
import { createDictionariesModule } from '../../src/modules/dictionaries/index.js';
import { createGeolocationModule, obfuscateCoordinates } from '../../src/modules/geolocation/index.js';
import type { LocationProvider } from '../../src/modules/geolocation/index.js';
import {
  AccessService,
  createProfilePhotosRouter,
  ProfilePhotosService,
  createProfileSettingsRouter,
  ProfileSettingsService,
  createUserBlocksRouter,
  createUsersModule
} from '../../src/modules/users/index.js';
import { createAuthModule, createAccountRecoveryLink } from '../../src/modules/auth/index.js';
import { BcryptPasswordHasher, PasskeyChallengeEntity, PasskeyChallengeRepositoryAdapter, PasswordCredentialEntity } from '../../src/modules/auth/infrastructure/index.js';
import { AccountEmailCodeUseCase } from '../../src/modules/auth/application/use-cases/account-email-code.use-case.js';
import { JwtTokenService } from '../../src/modules/auth/infrastructure/crypto/jwt-token.service.js';
import { createAuthMiddleware } from '../../src/modules/auth/presentation/http/auth.middleware.js';
import { ChangeEmailUseCase } from '../../src/modules/auth/application/use-cases/change-email.use-case.js';
import { JwtEmailChangeTokens } from '../../src/modules/auth/infrastructure/crypto/email-change-tokens.js';
import { TypeOrmEmailChangeStore } from '../../src/modules/auth/infrastructure/persistence/adapters/email-change.store.js';
import { createEmailChangeRouter } from '../../src/modules/auth/presentation/http/email-change.routes.js';
import type { ImageOwnership } from '../../src/modules/storage/index.js';
import type { AuthUser } from '../../src/modules/users/index.js';
import { UserBlockEntity, UserEntity, UserRepositoryAdapter } from '../../src/modules/users/infrastructure/index.js';
import { GetEventsUseCase } from '../../src/modules/events/application/index.js';
import { createEventsModule } from '../../src/modules/events/index.js';
import { createNotificationsModule } from '../../src/modules/notifications/index.js';
import type { CreateNotificationsModuleDependencies } from '../../src/modules/notifications/index.js';
import { NotificationEntity } from '../../src/modules/notifications/infrastructure/index.js';
import { createModerationModule } from '../../src/modules/moderation/index.js';
import { AuditLogEntity } from '../../src/modules/moderation/infrastructure/index.js';
import { toFeedEventView, toMapEventView } from '../../src/modules/events/presentation/http/event.view.js';
import { ListEventParticipationUseCase } from '../../src/modules/events/application/use-cases/list-event-participation.use-case.js';
import { toOwnParticipationView } from '../../src/modules/events/presentation/http/participation.view.js';
import { ManageParticipationUseCase } from '../../src/modules/events/application/use-cases/manage-participation.use-case.js';
import { ManageEventUseCase } from '../../src/modules/events/application/use-cases/manage-event.use-case.js';
import { AdvanceEventLifecycleUseCase } from '../../src/modules/events/application/use-cases/advance-event-lifecycle.use-case.js';
import type { CreateEventData } from '../../src/modules/events/application/index.js';
import {
  DiscussionCommentEntity,
  DiscussionCommentQuotaEntity,
  EventEntity,
  EventRepositoryAdapter,
  EventReviewEntity
} from '../../src/modules/events/infrastructure/index.js';
import { EventLifecycleRepositoryAdapter } from '../../src/modules/events/infrastructure/persistence/adapters/event-lifecycle.repository.adapter.js';
import { EventOccurrenceEntity } from '../../src/modules/events/infrastructure/persistence/entities/event-occurrence.entity.js';
import { EventParticipationEntity } from '../../src/modules/events/infrastructure/persistence/entities/event-participation.entity.js';
import { createTestDataSource } from './helpers/test-db.js';

describe('event management and feed with PostgreSQL', () => {
  const dataSource = createTestDataSource();
  const now = new Date('2026-11-25T12:00:00Z');
  let locations: LocationProvider;
  let getEvents: GetEventsUseCase;
  let kyivId: string;
  let lvivId: string;
  const locationIds: string[] = [];
  const districtIds: string[] = [];
  const categoryIds: string[] = [];
  const interestIds: string[] = [];

  let listParticipation: ListEventParticipationUseCase;
  let manageParticipation: ManageParticipationUseCase;
  let manageEvent: ManageEventUseCase;
  let categoryId: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    await dataSource.initialize();
    const { categories, cities, countries } = createDictionariesModule({ dataSource });
    const users = createUsersModule({ dataSource });
    listParticipation = new ListEventParticipationUseCase(
      new EventRepositoryAdapter(dataSource.getRepository(EventEntity)),
      users.access,
      users.blocks,
      users.profiles,
      () => now
    );
    manageParticipation = new ManageParticipationUseCase(
      new EventRepositoryAdapter(dataSource.getRepository(EventEntity)),
      new TypeOrmUnitOfWork(dataSource),
      users.authUsers,
      users.access,
      users.blocks,
      () => now
    );
    const kyiv = await cities.findBySlug('kyiv');
    const lviv = await cities.findBySlug('lviv');
    if (!kyiv || !lviv) throw new Error('Test cities are missing');
    kyivId = kyiv.id;
    lvivId = lviv.id;
    locations = createGeolocationModule({
      dataSource,
      cities,
      countries,
      users: users.users,
      requireAuth: (_req, _res, next) => next()
    }).locations;
    getEvents = new GetEventsUseCase(
      new EventRepositoryAdapter(dataSource.getRepository(EventEntity)),
      users.access,
      cities,
      users.profiles,
      users.blocks,
      () => now
    );
    categoryId = (await categories.listActive())[0].id;
    manageEvent = new ManageEventUseCase(
      new EventRepositoryAdapter(dataSource.getRepository(EventEntity)),
      new TypeOrmUnitOfWork(dataSource),
      new AccessService(),
      categories,
      locations,
      () => now
    );
  });

  afterAll(async () => {
    if (!dataSource.isInitialized) return;
    try {
      if (userIds.length) {
        await dataSource.query('DELETE FROM events WHERE organizer_id = ANY($1::uuid[])', [userIds]);
        await dataSource.query('DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])', [userIds]);
        await dataSource.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
      }
      if (locationIds.length) {
        await dataSource.query('DELETE FROM locations WHERE id = ANY($1::uuid[])', [locationIds]);
      }
      if (districtIds.length) {
        await dataSource.query('DELETE FROM districts WHERE id = ANY($1::uuid[])', [districtIds]);
      }
      if (categoryIds.length) {
        await dataSource.query('DELETE FROM categories WHERE id = ANY($1::uuid[])', [categoryIds]);
      }
      if (interestIds.length) {
        await dataSource.query('DELETE FROM interests WHERE id = ANY($1::uuid[])', [interestIds]);
      }
    } finally {
      await dataSource.destroy();
    }
  });

  async function createUser(): Promise<AuthUser> {
    const repo = new UserRepositoryAdapter(dataSource.getRepository(UserEntity));
    const user = await repo.create({ email: `${randomUUID()}@example.com`, name: 'Event test' });
    userIds.push(user.id);
    await dataSource.getRepository(UserEntity).update(user.id, {
      birthDate: new Date('2000-01-01T00:00:00Z'),
      emailVerified: true,
      onboardingCompleted: true
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      onboardingCompleted: true,
      birthDate: new Date('2000-01-01T00:00:00Z')
    };
  }

  function eventData(patch: Partial<CreateEventData> = {}): CreateEventData {
    return {
      categoryId,
      title: 'API event',
      description: 'Event lifecycle test',
      format: 'ONLINE',
      onlineUrl: 'https://example.com/meeting',
      participationMode: 'FREE',
      ageRestriction: 'ALL',
      isFree: true,
      firstStartsAt: new Date('2026-11-26T12:00:00Z'),
      firstEndsAt: new Date('2026-11-26T14:00:00Z'),
      ...patch
    };
  }

  function createEventsTestApi(testUsers: AuthUser[]) {
    return createEventsTestContext(testUsers).api;
  }

  function createEventsTestContext(
    testUsers: AuthUser[],
    sendEmail?: CreateNotificationsModuleDependencies['sendEmail'],
    images?: ImageOwnership
  ) {
    const viewers = new Map<string, AuthUser>(
      testUsers.map((user) => [user.id, user])
    );
    const optionalAuth: RequestHandler = (req, _res, next) => {
      const user = viewers.get(req.get('X-Test-User') ?? '');
      if (user) req.user = user;
      next();
    };
    const requireAuth: RequestHandler = (req, res, next) => {
      optionalAuth(req, res, () => {
        if (req.user) next();
        else res.sendStatus(401);
      });
    };
    const dictionaries = createDictionariesModule({ dataSource });
    const { categories, cities, countries, interests } = dictionaries;
    const users = createUsersModule({ dataSource });
    const geo = createGeolocationModule({
      dataSource,
      cities,
      countries,
      users: users.users,
      requireAuth
    });
    const notifications = createNotificationsModule({
      dataSource,
      requireAuth,
      sendEmail: sendEmail ?? (async () => {}),
      accountRecoveryLink: createAccountRecoveryLink
    });
    const moderation = createModerationModule({
      dataSource,
      users: users.users,
      access: users.access,
      blocks: users.blocks,
      notifications: notifications.publisher,
      requireAuth,
      requireRole: (...roles) => (req, res, next) => {
        if (req.user && roles.includes(req.user.role)) next();
        else res.sendStatus(403);
      }
    });
    const events = createEventsModule({
      dataSource,
      access: users.access,
      authUsers: users.authUsers,
      profiles: users.profiles,
      blocks: users.blocks,
      categories,
      cities,
      locations: geo.locations,
      optionalAuth,
      requireAuth,
      notifications: sendEmail ? notifications.publisher : undefined,
      images
    });
    const app = express();
    moderation.adminUsersRouter.use(dictionaries.adminRouter);
    app.use(express.json());
    app.use('/dictionaries', dictionaries.router);
    app.use('/events', events.router);
    app.use('/users', events.profilesRouter);
    app.use('/users/me/blocks', createUserBlocksRouter(requireAuth, users.blockSettings));
    app.use('/users/me/profile', createProfileSettingsRouter(
      requireAuth,
      users.profiles,
      new ProfileSettingsService(users.profileSettings, cities, interests)
    ));
    if (images) {
      app.use('/users/me/photos', createProfilePhotosRouter(
        requireAuth,
        new ProfilePhotosService(users.photos, (url, userId) => images.assertOwnedUrl(url, userId, 'PROFILE'))
      ));
    }
    app.use('/notifications', notifications.router);
    app.use('/admin', moderation.adminUsersRouter);
    app.use('/reports', moderation.reportsRouter);
    app.use('/geo', geo.router);
    app.use(errorHandler);
    return { api: request(app), notifications, moderation, events };
  }

  it('enforces administrator event permissions and caps participation requests per account', async () => {
    const [owner, viewer, staff] = await Promise.all([createUser(), createUser(), createUser()]);
    const api = createEventsTestApi([owner, viewer, { ...staff, role: 'ADMIN', birthDate: null }]);
    const event = await publishForFeed(owner, { ageRestriction: 'EIGHTEEN_PLUS' });
    await dataSource.getRepository(EventEntity).update(event.id, {
      firstStartsAt: new Date(Date.now() + 3_600_000),
      firstEndsAt: new Date(Date.now() + 7_200_000)
    });
    const feed = await api.get('/events').query({ format: 'ONLINE', limit: 50 })
      .set('X-Test-User', staff.id).expect(200);
    expect(feed.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: event.id })]));
    await api.post('/events').set('X-Test-User', staff.id).send(eventData()).expect(403);
    const path = `/events/${event.id}/participations`;
    await api.post(path).set('X-Test-User', staff.id).send({}).expect(403);
    for (let attempt = 0; attempt < 30; attempt++) {
      await api.post(path).set('X-Test-User', viewer.id).send({ unexpected: true }).expect(400);
    }
    await api.post(`/events/${randomUUID()}/participations`).set('X-Test-User', viewer.id)
      .send({}).expect(429).expect('Retry-After', /^[1-9]\d*$/);
    await api.post(path).set('X-Test-User', staff.id).send({}).expect(403);
  });

  it('manages outgoing blocks without changing an existing approval', async () => {
    const [owner, participant] = await Promise.all([createUser(), createUser()]);
    const api = createEventsTestApi([owner, participant]);
    const ownerEvent = await publishForFeed(owner, {});
    const participantEvent = await publishForFeed(participant, {});
    await manageParticipation.join(participant, ownerEvent.id);
    const path = '/users/me/blocks';

    await api.get(path).expect(401);
    await api.put(`${path}/${owner.id.toUpperCase()}`).set('X-Test-User', owner.id).expect(422);
    await api.put(`${path}/${randomUUID()}`).set('X-Test-User', owner.id).expect(404);
    await api.put(`${path}/${participant.id}`).set('X-Test-User', owner.id).expect(204);
    await api.put(`${path}/${participant.id}`).set('X-Test-User', owner.id).expect(204);
    const outgoing = await api.get(path).set('X-Test-User', owner.id).expect(200);
    expect(outgoing.body.data).toEqual([
      { userId: participant.id, createdAt: expect.any(String) }
    ]);
    const incoming = await api.get(path).set('X-Test-User', participant.id).expect(200);
    expect(incoming.body.data).toEqual([]);
    await api.delete(`${path}/${owner.id}`).set('X-Test-User', participant.id).expect(204);
    await api.get(`/events/${ownerEvent.id}`).set('X-Test-User', participant.id).expect(404);
    await api.get(`/events/${participantEvent.id}`).set('X-Test-User', owner.id).expect(200);

    await api.delete(`${path}/${participant.id}`).set('X-Test-User', owner.id).expect(204);
    await api.delete(`${path}/${participant.id}`).set('X-Test-User', owner.id).expect(204);
    const restored = await api.get(`/events/${ownerEvent.id}`)
      .set('X-Test-User', participant.id).expect(200);
    expect(restored.body.data.participationStatus).toBe('APPROVED');
    await dataSource.getRepository(UserEntity).update(participant.id, { status: 'PENDING_DELETION' });
    await api.put(`${path}/${participant.id}`).set('X-Test-User', owner.id).expect(404);
  });

  it('serves event details and protects private fields across event and geolocation routes', async () => {
    const [owner, applicant, participant, other, adminUser] = await Promise.all([
      createUser(),
      createUser(),
      createUser(),
      createUser(),
      createUser()
    ]);
    const admin: AuthUser = { ...adminUser, role: 'ADMIN' };
    const minor: AuthUser = { ...other, birthDate: new Date('2025-01-01T00:00:00Z') };
    const api = createEventsTestApi([owner, applicant, participant, minor, admin]);
    const get = (id: string, viewer?: AuthUser) =>
      api.get(`/events/${id}`).set('X-Test-User', viewer?.id ?? '');

    const onlineDraft = await manageEvent.create(
      owner,
      eventData({ participationMode: 'REQUEST', capacityLimit: 2, tags: ['privacy'] })
    );
    await get(onlineDraft.id).expect(404);
    await get(onlineDraft.id, owner).expect(200);
    await manageEvent.publish(owner, onlineDraft.id);
    const participations = dataSource.getRepository(EventParticipationEntity);
    await participations.save([
      { eventId: onlineDraft.id, userId: applicant.id, status: 'PENDING' },
      { eventId: onlineDraft.id, userId: participant.id, status: 'APPROVED' }
    ]);

    const guest = await get(onlineDraft.id).expect(200).expect('Cache-Control', 'private, no-store');
    expect(guest.body.data).toMatchObject({
      organizer: { id: owner.id },
      tags: ['privacy'],
      approvedParticipantCount: 1,
      availablePlaces: 1,
      participantAvatars: [],
      participationStatus: null,
      onlineUrl: null
    });
    expect(guest.body.data.organizer).not.toHaveProperty('email');
    const pending = await get(onlineDraft.id, applicant).expect(200);
    expect(pending.body.data).toMatchObject({
      participationStatus: 'PENDING',
      participantAvatars: [{ id: participant.id }],
      onlineUrl: null
    });
    expect(pending.body.data.participantAvatars[0]).not.toHaveProperty('email');
    for (const viewer of [owner, participant, admin]) {
      const response = await get(onlineDraft.id, viewer).expect(200);
      expect(response.body.data.onlineUrl).toBe(onlineDraft.onlineUrl);
    }

    const rows = dataSource.getRepository(EventEntity);
    await rows.update(onlineDraft.id, { ageRestriction: 'EIGHTEEN_PLUS' });
    await get(onlineDraft.id).expect(404);
    await get(onlineDraft.id, minor).expect(404);
    await get(onlineDraft.id, participant).expect(200);
    const blocks = dataSource.getRepository(UserBlockEntity);
    for (const [blockerId, blockedId, expectedStatus] of [
      [owner.id, participant.id, 404],
      [participant.id, owner.id, 200]
    ] as const) {
      await blocks.insert({ blockerId, blockedId });
      await get(onlineDraft.id, participant).expect(expectedStatus);
      await blocks.delete({ blockerId, blockedId });
      await get(onlineDraft.id, participant).expect(200);
    }
    await rows.update(onlineDraft.id, { ageRestriction: 'ALL', isHiddenByAdmin: true });
    await get(onlineDraft.id, participant).expect(404);
    await get(onlineDraft.id, owner).expect(200);
    await get(onlineDraft.id, admin).expect(200);
    await rows.update(onlineDraft.id, { isHiddenByAdmin: false, status: 'COMPLETED' });
    await get(onlineDraft.id).expect(200);
    const completed = await get(onlineDraft.id, participant).expect(200);
    expect(completed.body.data.actions).toMatchObject({
      canJoin: false,
      canApply: false,
      canCancelParticipation: false
    });
    await rows.update(onlineDraft.id, { status: 'CANCELLED', cancellationReason: 'Weather' });
    await get(onlineDraft.id).expect(404);
    const cancelled = await get(onlineDraft.id, applicant).expect(200);
    expect(cancelled.body.data.cancellationReason).toBe('Weather');

    const exactCoordinates = { latitude: 50.450123, longitude: 30.523456 };
    const location = await locations.create({
      name: 'Private venue',
      address: 'Private address',
      cityId: kyivId,
      districtId: null,
      countryCode: 'UA',
      exactCoordinates,
      publicCoordinates: exactCoordinates,
      provider: 'manual',
      providerPlaceId: null,
      createdBy: null
    });
    locationIds.push(location.id);
    const existingEvent = await publishForFeed(applicant, {
      format: 'OFFLINE',
      onlineUrl: null,
      primaryLocationId: location.id
    });
    const exactLookup = `/geo/locations/${location.id}?precision=EXACT`;
    await api.get(exactLookup).set('X-Test-User', other.id).expect(200);
    const offlineDraft = await manageEvent.create(
      owner,
      eventData({
        format: 'OFFLINE',
        onlineUrl: null,
        primaryLocationId: location.id,
        hideExactAddress: true
      })
    );
    const draftCard = await get(offlineDraft.id, owner).expect(200);
    expect(draftCard.body.data.location).toMatchObject({
      address: location.address,
      isExact: true
    });
    const offline = await manageEvent.publish(owner, offlineDraft.id);
    const sharedCard = await get(existingEvent.id, applicant).expect(200);
    expect(sharedCard.body.data.location).toMatchObject({ isExact: false, address: null });
    await participations.save({ eventId: offline.id, userId: participant.id, status: 'APPROVED' });
    const publicCard = await get(offline.id).expect(200);
    expect(publicCard.body.data).not.toHaveProperty('primaryLocationId');
    expect(publicCard.body.data.location).toMatchObject({
      address: null,
      name: null,
      isExact: false
    });
    expect(publicCard.body.data.location.coordinates).not.toEqual(exactCoordinates);
    expect(sharedCard.body.data.location.coordinates).toEqual(publicCard.body.data.location.coordinates);
    for (const viewer of [owner, participant, admin]) {
      const privateCard = await get(offline.id, viewer).expect(200);
      expect(privateCard.body.data.location).toMatchObject({
        coordinates: exactCoordinates,
        address: location.address,
        isExact: true
      });
    }
    await api.get(`/geo/locations/${location.id}`).expect(404);
    await api.get(exactLookup).set('X-Test-User', other.id).expect(404);
    await expect(
      manageEvent.create(
        applicant,
        eventData({ format: 'OFFLINE', onlineUrl: null, primaryLocationId: location.id })
      )
    ).rejects.toMatchObject({ message: 'Event location not found' });
    const nearby = await api.get('/geo/locations/nearby').query(exactCoordinates).expect(200);
    expect(nearby.body.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ location: expect.objectContaining({ id: location.id }) })
      ])
    );
    const bbox = await api
      .get('/geo/locations/bbox')
      .query({ minLat: 50.44, minLng: 30.51, maxLat: 50.46, maxLng: 30.54 })
      .expect(200);
    expect(bbox.body.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: location.id })])
    );
  });

  it('lists personal events by tab with private, stable cursor pagination', async () => {
    const [viewer, host, blockedHost] = await Promise.all([createUser(), createUser(), createUser()]);
    const minor: AuthUser = { ...viewer, birthDate: new Date(Date.now() - 10 * 365 * 86_400_000) };
    const api = createEventsTestApi([minor, host]);
    const mine = (tab: string, limit = 20, cursor?: string) =>
      api
        .get('/events/me')
        .set('X-Test-User', viewer.id)
        .query({ tab, limit, ...(cursor ? { cursor } : {}) });

    await api.get('/events/me').query({ tab: 'GOING' }).expect(401);
    await mine('UNKNOWN').expect(400);
    await mine('GOING', 0).expect(400);
    await mine('GOING', 20, 'invalid').expect(400);

    const draft = await manageEvent.create(
      viewer,
      eventData({ firstStartsAt: null, firstEndsAt: null })
    );
    await manageEvent.create(host, eventData());
    const organizing = await publishForFeed(viewer, {});
    const cancelled = await publishForFeed(viewer, {});
    const first = await publishForFeed(host, {});
    const second = await publishForFeed(host, {});
    const hidden = await publishForFeed(host, {});
    const blocked = await publishForFeed(blockedHost, {});
    const restricted = await publishForFeed(host, { ageRestriction: 'EIGHTEEN_PLUS' });
    const pending = await publishForFeed(host, { participationMode: 'REQUEST' });
    const rejected = await publishForFeed(host, { participationMode: 'REQUEST' });
    const notConsidered = await publishForFeed(host, { participationMode: 'REQUEST' });
    const ended = await publishForFeed(host, {});
    const completed = await publishForFeed(viewer, {});

    const currentTime = Date.now();
    const hour = 60 * 60 * 1000;
    const schedule = {
      firstStartsAt: new Date(currentTime - hour),
      firstEndsAt: new Date(currentTime + hour)
    };
    const events = dataSource.getRepository(EventEntity);
    await events.update(
      [first.id, second.id, hidden.id, blocked.id, restricted.id, organizing.id],
      schedule
    );
    await events.update(second.id, { status: 'FULL' });
    await events.update([organizing.id, hidden.id], { isHiddenByAdmin: true });
    await events.update(cancelled.id, {
      ...schedule,
      status: 'CANCELLED',
      cancellationReason: 'Weather'
    });
    await events.update(ended.id, {
      firstStartsAt: new Date(currentTime - 2 * hour),
      firstEndsAt: new Date(currentTime - hour)
    });
    await events.update(completed.id, {
      status: 'COMPLETED',
      firstStartsAt: new Date(currentTime - 3 * hour),
      firstEndsAt: new Date(currentTime - 2 * hour)
    });
    await dataSource.getRepository(UserBlockEntity).insert({
      blockerId: blockedHost.id,
      blockedId: viewer.id
    });
    const participations = dataSource.getRepository(EventParticipationEntity);
    await participations.save([
      ...[first, second, hidden, blocked, restricted, ended, organizing].map(({ id }) => ({
        eventId: id,
        userId: viewer.id,
        status: 'APPROVED' as const
      })),
      {
        eventId: pending.id,
        userId: viewer.id,
        status: 'PENDING',
        statusUpdatedAt: new Date(currentTime)
      },
      {
        eventId: rejected.id,
        userId: viewer.id,
        status: 'REJECTED',
        statusUpdatedAt: new Date(currentTime - hour)
      },
      {
        eventId: notConsidered.id,
        userId: viewer.id,
        status: 'NOT_CONSIDERED',
        statusUpdatedAt: new Date(currentTime - 2 * hour)
      },
      { eventId: first.id, userId: blockedHost.id, status: 'PENDING' }
    ]);

    const [firstId, secondId] = [first.id, second.id].sort();
    const page = await mine('GOING', 1).expect(200).expect('Cache-Control', 'private, no-store');
    expect(page.body.data).toMatchObject([
      { id: firstId, isOrganizer: false, participationStatus: 'APPROVED' }
    ]);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.data[0]).not.toHaveProperty('onlineUrl');
    expect(page.body.data[0]).not.toHaveProperty('primaryLocationId');
    expect(page.body.pagination).toMatchObject({ nextCursor: expect.any(String), hasMore: true });
    const next = await mine('GOING', 1, page.body.pagination.nextCursor).expect(200);
    expect(next.body.data).toMatchObject([{ id: secondId }]);
    expect(next.body.data).toHaveLength(1);
    expect(next.body.pagination).toEqual({ nextCursor: null, hasMore: false });
    await mine('DRAFTS', 1, page.body.pagination.nextCursor).expect(400);

    const applications = await mine('APPLICATIONS', 2).expect(200);
    expect(applications.body.data).toMatchObject([
      { id: pending.id, participationStatus: 'PENDING' },
      { id: rejected.id, participationStatus: 'REJECTED' }
    ]);
    expect(applications.body.pagination).toMatchObject({
      nextCursor: expect.any(String),
      hasMore: true
    });
    const moreApplications = await mine('APPLICATIONS', 2, applications.body.pagination.nextCursor)
      .expect(200);
    expect(moreApplications.body.data).toMatchObject([
      { id: notConsidered.id, participationStatus: 'NOT_CONSIDERED' }
    ]);
    expect(moreApplications.body.pagination).toEqual({ nextCursor: null, hasMore: false });

    const hosted = await mine('ORGANIZING').expect(200);
    expect(hosted.body.data).toMatchObject([
      { id: organizing.id, isOrganizer: true, isHiddenByAdmin: true, participationStatus: null }
    ]);
    const drafts = await mine('DRAFTS').expect(200);
    expect(drafts.body.data).toMatchObject([{ id: draft.id, status: 'DRAFT', firstStartsAt: null }]);
    const past = await mine('PAST', 1).expect(200);
    expect(past.body.data).toMatchObject([
      { id: cancelled.id, status: 'CANCELLED', cancellationReason: 'Weather', isOrganizer: true }
    ]);
    const morePast = await mine('PAST', 2, past.body.pagination.nextCursor).expect(200);
    expect(morePast.body.data).toMatchObject([
      { id: ended.id, status: 'PUBLISHED', participationStatus: 'APPROVED', isOrganizer: false },
      { id: completed.id, status: 'COMPLETED', isOrganizer: true }
    ]);
    expect(morePast.body.pagination).toEqual({ nextCursor: null, hasMore: false });
  });

  it('guards ownership, publishes and reschedules one occurrence, then duplicates and cancels', async () => {
    const owner = await createUser();
    const other = await createUser();
    const draft = await manageEvent.create(owner, eventData({ tags: ['community'] }));
    expect(await manageEvent.getDraft(other, draft.id)).toBeNull();
    await expect(manageEvent.publish(other, draft.id)).rejects.toMatchObject({ statusCode: 404 });
    await manageEvent.update(owner, draft.id, { title: 'Updated event' });
    expect(await manageEvent.publish(owner, draft.id)).toMatchObject({
      title: 'Updated event',
      status: 'PUBLISHED',
      tags: ['community']
    });

    const occurrences = dataSource.getRepository(EventOccurrenceEntity);
    const occurrence = await occurrences.findOneByOrFail({ eventId: draft.id });
    const firstStartsAt = new Date('2026-11-26T13:00:00Z');
    await manageEvent.update(owner, draft.id, { firstStartsAt });
    expect(await occurrences.findBy({ eventId: draft.id })).toMatchObject([
      { id: occurrence.id, startsAt: firstStartsAt, status: 'SCHEDULED' }
    ]);

    const copy = await manageEvent.duplicate(owner, draft.id);
    expect(copy.id).not.toBe(draft.id);
    expect(copy).toMatchObject({
      status: 'DRAFT',
      firstStartsAt: null,
      firstEndsAt: null,
      publishedAt: null,
      tags: ['community']
    });
    expect(await occurrences.countBy({ eventId: copy.id })).toBe(0);
    await manageEvent.delete(owner, copy.id);

    await expect(manageEvent.cancel(owner, draft.id, '   ')).rejects.toThrow();
    await manageEvent.cancel(owner, draft.id, 'Venue closed');
    expect(await occurrences.findOneByOrFail({ eventId: draft.id })).toMatchObject({
      status: 'CANCELLED'
    });
  });

  it('requires age, verification, onboarding, an active account and a known category', async () => {
    const owner = await createUser();
    const teen = { ...owner, birthDate: new Date('2009-01-01T00:00:00Z') };
    const minor = { ...owner, birthDate: new Date('2011-01-01T00:00:00Z') };

    await expect(manageEvent.create(minor, eventData()))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(manageEvent.create(teen, eventData({ ageRestriction: 'EIGHTEEN_PLUS' })))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(manageEvent.create(teen, eventData({ ageRestriction: 'SIXTEEN_PLUS' })))
      .resolves.toMatchObject({ status: 'DRAFT' });

    for (const applicant of [
      { ...owner, emailVerified: false },
      { ...owner, onboardingCompleted: false },
      { ...owner, status: 'BLOCKED_PERMANENT' as const }
    ]) {
      await expect(manageEvent.create(applicant, eventData()))
        .rejects.toMatchObject({ statusCode: 403 });
    }

    await expect(manageEvent.create(owner, eventData({ categoryId: randomUUID() })))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  it('serializes concurrent publication for the last slot in the organizer quota', async () => {
    const owner = await createUser();
    for (let index = 0; index < 9; index += 1) {
      const draft = await manageEvent.create(owner, eventData());
      await manageEvent.publish(owner, draft.id);
    }
    const first = await manageEvent.create(owner, eventData());
    const second = await manageEvent.create(owner, eventData());
    const results = await Promise.allSettled([
      manageEvent.publish(owner, first.id),
      manageEvent.publish(owner, second.id)
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results).toContainEqual({
      status: 'rejected',
      reason: expect.objectContaining({ message: 'Upcoming event limit reached' })
    });
  });

  it('uses only approved non-organizers for capacity and protects participants', async () => {
    const owner = await createUser();
    const first = await createUser();
    const second = await createUser();
    const draft = await manageEvent.create(owner, eventData());
    await manageEvent.publish(owner, draft.id);
    const participations = dataSource.getRepository(EventParticipationEntity);
    await participations.insert([
      { eventId: draft.id, userId: owner.id, status: 'APPROVED' },
      { eventId: draft.id, userId: first.id, status: 'APPROVED' },
      { eventId: draft.id, userId: second.id, status: 'PENDING' }
    ]);

    expect(await manageEvent.update(owner, draft.id, { capacityLimit: 1 })).toMatchObject({
      status: 'FULL'
    });
    await expect(manageEvent.update(owner, draft.id, { ageRestriction: 'EIGHTEEN_PLUS' }))
      .rejects.toThrow('Event format or age restriction');
    await expect(manageEvent.delete(owner, draft.id)).rejects.toThrow('current status');
    await expect(manageEvent.cancel(owner, draft.id, 'Cancelled')).resolves.toMatchObject({
      status: 'CANCELLED'
    });
  });

  async function publishForFeed(owner: AuthUser, patch: Partial<CreateEventData>) {
    const draft = await manageEvent.create(owner, eventData(patch));
    return manageEvent.publish(owner, draft.id);
  }

  it('filters before pagination and keeps the online fallback stable across equal dates', async () => {
    const owner = await createUser();
    const blockedByViewer = await createUser();
    const blockingViewer = await createUser();
    const viewer = {
      ...await createUser(),
      birthDate: new Date('2011-01-01T00:00:00Z')
    };
    await dataSource.getRepository(UserBlockEntity).insert([
      { blockerId: viewer.id, blockedId: blockedByViewer.id },
      { blockerId: blockingViewer.id, blockedId: viewer.id }
    ]);

    const tag = randomUUID().replaceAll('-', '').slice(0, 30);
    const base = { tags: [tag], participationMode: 'REQUEST' as const };
    const open = await publishForFeed(owner, base);
    const full = await publishForFeed(owner, { ...base, capacityLimit: 1 });
    const restricted = await publishForFeed(owner, { ...base, ageRestriction: 'SIXTEEN_PLUS' });
    const hidden = await publishForFeed(owner, base);
    const past = await publishForFeed(owner, base);
    const paid = await publishForFeed(owner, { ...base, isFree: false, priceText: '10 UAH' });
    const outgoingBlockEvent = await publishForFeed(blockedByViewer, base);
    await publishForFeed(blockingViewer, base);

    const events = dataSource.getRepository(EventEntity);
    await events.update(hidden.id, { isHiddenByAdmin: true });
    await events.update(past.id, {
      firstStartsAt: new Date('2026-11-24T12:00:00Z'),
      firstEndsAt: new Date('2026-11-24T14:00:00Z')
    });
    await events.update(full.id, { status: 'FULL' });

    const query = {
      limit: 1,
      search: tag.toUpperCase(),
      freeOnly: true,
      participationMode: 'REQUEST' as const,
      categoryId,
      period: 'TOMORROW' as const
    };
    const firstPage = await getEvents.execute(query, viewer);
    expect(firstPage.nextCursor).not.toBeNull();
    const secondPage = await getEvents.execute(
      { ...query, cursor: firstPage.nextCursor ?? undefined },
      viewer
    );
    expect(secondPage.nextCursor).not.toBeNull();
    const thirdPage = await getEvents.execute(
      { ...query, cursor: secondPage.nextCursor ?? undefined },
      viewer
    );
    const items = [...firstPage.items, ...secondPage.items, ...thirdPage.items];
    expect(items.map((event) => event.id)).toEqual([open.id, full.id, outgoingBlockEvent.id].sort());
    expect(thirdPage.nextCursor).toBeNull();
    expect(items.find((event) => event.id === full.id)?.hasAvailablePlaces).toBe(false);
    expect(toFeedEventView(items[0])).not.toHaveProperty('onlineUrl');

    const onlyAvailable = await getEvents.execute({ ...query, limit: 3, availableOnly: true }, viewer);
    expect(onlyAvailable.items.map((event) => event.id)).toEqual([open.id, outgoingBlockEvent.id].sort());
    expect(items.map((event) => event.id)).not.toContain(restricted.id);
    expect(items.map((event) => event.id)).not.toContain(paid.id);
  });

  it('prefers the selected city and applies relative dates in its timezone', async () => {
    const owner = await createUser();
    const tag = randomUUID().replaceAll('-', '').slice(0, 30);
    const exactCoordinates = { latitude: 50.450123, longitude: 30.523456 };
    const location = await locations.create({
      name: 'Private venue',
      address: 'Private venue address',
      cityId: kyivId,
      districtId: null,
      countryCode: 'UA',
      exactCoordinates,
      publicCoordinates: obfuscateCoordinates(exactCoordinates),
      provider: 'manual',
      providerPlaceId: null,
      createdBy: null
    });
    locationIds.push(location.id);

    const schedule = {
      firstStartsAt: new Date('2026-11-27T22:30:00Z'),
      firstEndsAt: new Date('2026-11-28T01:00:00Z')
    };
    const local = await publishForFeed(owner, {
      ...schedule,
      tags: [tag],
      format: 'OFFLINE',
      primaryLocationId: location.id,
      onlineUrl: null,
      hideExactAddress: true
    });
    const online = await publishForFeed(owner, { ...schedule, tags: [tag] });
    const query = { limit: 10, search: tag, period: 'WEEKEND' as const };
    const kyiv = await getEvents.execute(query, null);
    expect(kyiv.items.map((event) => event.id)).toEqual([local.id]);
    expect(toFeedEventView(kyiv.items[0])).not.toHaveProperty('primaryLocationId');
    expect(toFeedEventView(kyiv.items[0])).not.toHaveProperty('address');

    const lviv = await getEvents.execute({ ...query, cityId: lvivId }, null);
    expect(lviv.items.map((event) => event.id)).toEqual([online.id]);
    const viewer = await createUser();
    await dataSource.getRepository(UserEntity).update(viewer.id, { cityId: lvivId });
    expect((await getEvents.execute(query, viewer)).items.map((event) => event.id))
      .toEqual([online.id]);
    expect((await getEvents.execute({ ...query, cityId: kyivId }, viewer)).items
      .map((event) => event.id)).toEqual([local.id]);
    expect((await getEvents.execute({ ...query, to: schedule.firstStartsAt }, null)).items)
      .toEqual([]);
  });

  it('uses the same public point for map bounds, marker and distance, including ties', async () => {
    const owner = await createUser();
    const tag = randomUUID().replaceAll('-', '').slice(0, 30);
    const exactCoordinates = { latitude: 50.454321, longitude: 30.524321 };
    const origin = { latitude: 50.4498, longitude: 30.5198 };
    const districtId = randomUUID();
    const districtName = `District fixture ${districtId}`;
    districtIds.push(districtId);
    await dataSource.query(
      `INSERT INTO districts (id, city_id, name, center, boundary)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
         ST_MakeEnvelope(30.519, 50.449, 30.525, 50.455, 4326)::geography)`,
      [districtId, kyivId, districtName, origin.longitude, origin.latitude]
    );
    const location = await locations.create({
      name: 'Hidden map venue',
      address: 'Private venue address',
      cityId: kyivId,
      districtId,
      countryCode: 'UA',
      exactCoordinates,
      publicCoordinates: exactCoordinates,
      provider: 'manual',
      providerPlaceId: null,
      createdBy: null
    });
    locationIds.push(location.id);
    const offline = {
      tags: [tag],
      format: 'OFFLINE' as const,
      primaryLocationId: location.id,
      onlineUrl: null
    };
    const hidden = await publishForFeed(owner, { ...offline, hideExactAddress: true });
    const tied = await publishForFeed(owner, { ...offline, hideExactAddress: true });
    const visible = await publishForFeed(owner, offline);
    await publishForFeed(owner, { tags: [tag] });

    // Older snapshots could have copied the exact point before the address was hidden.
    await dataSource.query(
      'UPDATE event_location_snapshot SET public_coordinates = coordinates WHERE event_id = $1',
      [hidden.id]
    );

    const mapQuery = {
      limit: 1,
      search: tag,
      bounds: { minLat: 50.449, minLng: 30.519, maxLat: 50.451, maxLng: 30.521 }
    };
    const firstMap = await getEvents.execute(mapQuery, null);
    expect(firstMap.nextCursor).not.toBeNull();
    const secondMap = await getEvents.execute(
      { ...mapQuery, cursor: firstMap.nextCursor ?? undefined },
      null
    );
    const markers = [...firstMap.items, ...secondMap.items].map(toMapEventView);
    expect(markers.map((marker) => marker.id)).toEqual([hidden.id, tied.id].sort());
    expect(markers[0]).toMatchObject({ coordinates: origin, districtName });
    const api = createEventsTestApi([owner]);
    const card = await api.get(`/events/${hidden.id}`).expect(200);
    expect(card.body.data.location).toMatchObject({
      coordinates: origin, districtId, districtName, address: null, isExact: false
    });
    expect(markers[0]).not.toHaveProperty('primaryLocationId');
    expect(markers[0]).not.toHaveProperty('address');
    expect(secondMap.nextCursor).toBeNull();

    const exactViewport = await getEvents.execute({
      limit: 10,
      search: tag,
      bounds: { minLat: 50.454, minLng: 30.524, maxLat: 50.455, maxLng: 30.525 }
    }, null);
    expect(exactViewport.items.map(toMapEventView)).toMatchObject([
      { id: visible.id, coordinates: exactCoordinates }
    ]);

    const query = { limit: 1, search: tag, origin };
    const firstDistance = await getEvents.execute(query, null);
    const secondDistance = await getEvents.execute(
      { ...query, cursor: firstDistance.nextCursor ?? undefined }, null
    );
    const thirdDistance = await getEvents.execute(
      { ...query, cursor: secondDistance.nextCursor ?? undefined }, null
    );
    expect([firstDistance.items[0].id, secondDistance.items[0].id])
      .toEqual([hidden.id, tied.id].sort());
    expect(firstDistance.items[0].distanceMeters).toBe(0);
    expect(secondDistance.items[0].distanceMeters).toBe(0);
    expect(thirdDistance.items[0].id).toBe(visible.id);
    expect(thirdDistance.items[0].distanceMeters).toBeGreaterThan(0);
    expect(thirdDistance.nextCursor).toBeNull();
    await expect(getEvents.execute({
      ...mapQuery,
      cursor: firstDistance.nextCursor ?? undefined
    }, null)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('filters future events by active interests matching a category or tag', async () => {
    const [owner, viewer] = await Promise.all([createUser(), createUser()]);
    const { categories, interests } = createDictionariesModule({ dataSource });
    const category = (await categories.listActive()).find(({ slug }) => slug === 'board-games')!;
    const interest = (await interests.listActive()).find(({ name }) => name === category.name)!;
    await dataSource.query('INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2)', [
      viewer.id, interest.id
    ]);
    const categoryMatch = await publishForFeed(owner, { categoryId: category.id });
    const tagMatch = await publishForFeed(owner, { tags: [interest.name] });
    const unrelated = await publishForFeed(owner, {});
    const hidden = await publishForFeed(owner, { tags: [interest.name] });
    const events = dataSource.getRepository(EventEntity);
    await events.update([categoryMatch.id, tagMatch.id, unrelated.id, hidden.id], {
      firstStartsAt: new Date(Date.now() + 3_600_000),
      firstEndsAt: new Date(Date.now() + 7_200_000)
    });
    await events.update(hidden.id, { isHiddenByAdmin: true });
    const api = createEventsTestApi([owner, viewer]);
    const query = { byInterests: true, format: 'ONLINE' };
    await api.get('/events').query(query).expect(401);
    const empty = await api.get('/events').query(query).set('X-Test-User', owner.id).expect(200);
    expect(empty.body.data).toEqual([]);
    const personalized = await api.get('/events').query(query).set('X-Test-User', viewer.id).expect(200);
    expect(personalized.body.data.map(({ id }: { id: string }) => id).sort())
      .toEqual([categoryMatch.id, tagMatch.id].sort());
  });

  it('serializes free joins, releases a place, and remembers the first approval', async () => {
    const owner = await createUser();
    const first = await createUser();
    const second = await createUser();
    const event = await publishForFeed(owner, { capacityLimit: 1 });
    const [firstResult, secondResult] = await Promise.allSettled([
      manageParticipation.join(first, event.id),
      manageParticipation.join(second, event.id)
    ]);
    expect([firstResult.status, secondResult.status].sort()).toEqual(['fulfilled', 'rejected']);
    const winner = firstResult.status === 'fulfilled' ? first : second;
    const other = winner === first ? second : first;
    const failed = winner === first ? secondResult : firstResult;
    expect(failed).toMatchObject({ status: 'rejected', reason: { statusCode: 409 } });

    const events = dataSource.getRepository(EventEntity);
    const occurrences = dataSource.getRepository(EventOccurrenceEntity);
    const participations = dataSource.getRepository(EventParticipationEntity);
    expect(await events.findOneByOrFail({ id: event.id })).toMatchObject({
      status: 'FULL', hasApprovedParticipants: true
    });
    expect(await occurrences.findOneByOrFail({ eventId: event.id })).toMatchObject({
      status: 'FULL'
    });
    const approved = await participations.findOneByOrFail({ eventId: event.id, userId: winner.id });
    await expect(manageParticipation.join(winner, event.id)).resolves.toMatchObject({
      participation: { id: approved.id, status: 'APPROVED' }
    });
    expect(await participations.countBy({ eventId: event.id })).toBe(1);

    await expect(manageParticipation.cancel(winner, event.id)).resolves.toMatchObject({
      status: 'CANCELLED_BY_USER'
    });
    expect(await events.findOneByOrFail({ id: event.id })).toMatchObject({
      status: 'PUBLISHED', hasApprovedParticipants: true
    });
    expect(await occurrences.findOneByOrFail({ eventId: event.id })).toMatchObject({
      status: 'SCHEDULED'
    });
    await expect(manageEvent.delete(owner, event.id)).rejects.toMatchObject({ statusCode: 409 });
    await expect(manageEvent.update(owner, event.id, { ageRestriction: 'EIGHTEEN_PLUS' }))
      .rejects.toMatchObject({ statusCode: 409 });
    await expect(manageParticipation.join(winner, event.id))
      .rejects.toMatchObject({ statusCode: 409 });
    await expect(manageParticipation.join(other, event.id)).resolves.toMatchObject({
      participation: { status: 'APPROVED' }
    });
  });

  it('applies age, block and event access before joining and warns about schedule conflicts', async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const teen = { ...viewer, birthDate: new Date('2009-01-01T00:00:00Z') };
    const restricted = await publishForFeed(owner, { ageRestriction: 'EIGHTEEN_PLUS' });
    await expect(manageParticipation.join(teen, restricted.id))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(manageParticipation.join(owner, restricted.id))
      .rejects.toMatchObject({ statusCode: 409 });
    await expect(manageParticipation.join({ ...viewer, emailVerified: false }, restricted.id))
      .rejects.toMatchObject({ statusCode: 403 });

    const blocks = dataSource.getRepository(UserBlockEntity);
    await blocks.insert({ blockerId: owner.id, blockedId: viewer.id });
    await expect(manageParticipation.join(viewer, restricted.id))
      .rejects.toMatchObject({ statusCode: 404 });
    await blocks.delete({ blockerId: owner.id, blockedId: viewer.id });
    const reverseViewer = await createUser();
    await blocks.insert({ blockerId: reverseViewer.id, blockedId: owner.id });
    await expect(manageParticipation.join(reverseViewer, restricted.id))
      .resolves.toMatchObject({ participation: { status: 'APPROVED' } });

    const request = await publishForFeed(owner, { participationMode: 'REQUEST' });
    await expect(manageParticipation.join(viewer, request.id)).resolves.toMatchObject({
      participation: { status: 'PENDING' }
    });

    const overlap = await publishForFeed(owner, {});
    await expect(manageParticipation.join(viewer, overlap.id)).resolves.toMatchObject({
      warnings: []
    });
    await expect(manageParticipation.join(viewer, restricted.id)).resolves.toMatchObject({
      warnings: ['SCHEDULE_CONFLICT']
    });

    const events = dataSource.getRepository(EventEntity);
    await events.update(restricted.id, { firstStartsAt: now });
    await expect(manageParticipation.cancel(viewer, restricted.id))
      .rejects.toMatchObject({ statusCode: 409 });
    await expect(manageParticipation.join(await createUser(), restricted.id))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('serializes approvals, keeps pending requests outside capacity and releases a removed place', async () => {
    const owner = await createUser();
    const first = await createUser();
    const second = await createUser();
    const third = await createUser();
    const event = await publishForFeed(owner, { participationMode: 'REQUEST', capacityLimit: 1 });
    const a = (await manageParticipation.join(first, event.id, 'First message')).participation;
    const b = (await manageParticipation.join(second, event.id)).participation;
    expect(a.status).toBe('PENDING');
    expect(b.status).toBe('PENDING');
    const events = dataSource.getRepository(EventEntity);
    expect(await events.findOneByOrFail({ id: event.id })).toMatchObject({ status: 'PUBLISHED' });
    await expect(manageParticipation.decide(first, event.id, b.id, 'APPROVED'))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(listParticipation.execute(first, event.id, 'APPLICATIONS', { limit: 10 }))
      .rejects.toMatchObject({ statusCode: 404 });

    const page = await listParticipation.execute(owner, event.id, 'APPLICATIONS', { limit: 1 });
    const next = await listParticipation.execute(owner, event.id, 'APPLICATIONS', {
      limit: 1,
      cursor: page.nextCursor ?? undefined
    });
    expect([...page.items, ...next.items].map(({ participation }) => participation.id))
      .toEqual([a.id, b.id].sort());

    const outcomes = await Promise.allSettled([
      manageParticipation.decide(owner, event.id, a.id, 'APPROVED'),
      manageParticipation.decide(owner, event.id, b.id, 'APPROVED')
    ]);
    expect(outcomes.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const winner = outcomes[0].status === 'fulfilled' ? a : b;
    const loser = winner.id === a.id ? b : a;
    const winnerUser = winner.id === a.id ? first : second;
    const loserUser = winner.id === a.id ? second : first;

    expect(await events.findOneByOrFail({ id: event.id })).toMatchObject({ status: 'FULL' });
    await expect(manageParticipation.join(third, event.id)).resolves.toMatchObject({
      participation: { status: 'PENDING' }
    });
    await expect(listParticipation.execute(loserUser, event.id, 'PARTICIPANTS', { limit: 10 }))
      .rejects.toMatchObject({ statusCode: 403 });
    const roster = await listParticipation.execute(winnerUser, event.id, 'PARTICIPANTS', {
      limit: 10
    });
    expect(roster.organizer).toMatchObject({ id: owner.id });
    expect(roster.items.map(({ profile }) => profile.id)).toEqual([winner.userId]);
    expect(roster.items[0].profile).not.toHaveProperty('email');

    const removed = await manageParticipation.remove(owner, event.id, winner.id, 'Private reason');
    expect(toOwnParticipationView(removed)).not.toHaveProperty('removalReason');
    expect(await events.findOneByOrFail({ id: event.id })).toMatchObject({ status: 'PUBLISHED' });
    await expect(manageParticipation.decide(owner, event.id, loser.id, 'APPROVED'))
      .resolves.toMatchObject({ status: 'APPROVED' });
  });

  it('rejects without storing a reason and forbids reapplying', async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const event = await publishForFeed(owner, { participationMode: 'REQUEST' });
    const { participation } = await manageParticipation.join(applicant, event.id, 'Hello');
    const blocks = dataSource.getRepository(UserBlockEntity);
    await blocks.insert({ blockerId: owner.id, blockedId: applicant.id });
    await expect(manageParticipation.decide(owner, event.id, participation.id, 'APPROVED'))
      .rejects.toMatchObject({ statusCode: 409 });

    const rejected = await manageParticipation.decide(
      owner,
      event.id,
      participation.id,
      'REJECTED'
    );
    expect(rejected).toMatchObject({ status: 'REJECTED', removalReason: null });
    expect(toOwnParticipationView(rejected)).not.toHaveProperty('removalReason');
    await blocks.delete({ blockerId: owner.id, blockedId: applicant.id });
    await expect(manageParticipation.join(applicant, event.id)).rejects.toMatchObject({
      statusCode: 409
    });
  });

  it('keeps a published event with pending applications and restricts cancellation and deletion by status', async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const draft = await manageEvent.create(owner, eventData({ tags: [' Meetup ', 'MEETUP'] }));
    expect(draft.tags).toEqual(['meetup']);
    await expect(manageEvent.cancel(owner, draft.id, 'Venue closed')).rejects.toMatchObject({
      statusCode: 409
    });

    const event = await publishForFeed(owner, { participationMode: 'REQUEST' });
    await manageParticipation.join(applicant, event.id);
    await expect(manageEvent.delete(owner, event.id)).rejects.toThrow('pending applications');
    await manageParticipation.cancel(applicant, event.id);
    await expect(manageEvent.delete(owner, event.id)).resolves.toBeUndefined();

    const cancelled = await publishForFeed(owner, {});
    await manageEvent.cancel(owner, cancelled.id, 'Venue closed');
    await expect(manageEvent.delete(owner, cancelled.id)).rejects.toThrow('current status');
  });

  it('expires pending applications at the start and completes events and occurrences at the end', async () => {
    const [owner, applicant, approvedUser, rejectedUser] = await Promise.all([
      createUser(),
      createUser(),
      createUser(),
      createUser()
    ]);
    const event = await publishForFeed(owner, { participationMode: 'REQUEST', capacityLimit: 1 });
    const { participation: pending } = await manageParticipation.join(applicant, event.id, 'Hello');
    const { participation: approved } = await manageParticipation.join(approvedUser, event.id);
    const { participation: rejected } = await manageParticipation.join(rejectedUser, event.id);
    await manageParticipation.decide(owner, event.id, approved.id, 'APPROVED');
    await manageParticipation.decide(owner, event.id, rejected.id, 'REJECTED');
    const draft = await manageEvent.create(owner, eventData());
    const cancelled = await publishForFeed(owner, { participationMode: 'REQUEST' });
    const cancelledApplication = await manageParticipation.join(applicant, cancelled.id);
    await manageEvent.cancel(owner, cancelled.id, 'Venue closed');

    const start = new Date('2026-11-26T12:00:00Z');
    const end = new Date('2026-11-26T14:00:00Z');
    let cutoff = new Date(start.getTime() - 1);
    const lifecycle = new AdvanceEventLifecycleUseCase(
      new EventLifecycleRepositoryAdapter(),
      new TypeOrmUnitOfWork(dataSource),
      () => cutoff
    );
    const events = dataSource.getRepository(EventEntity);
    const occurrences = dataSource.getRepository(EventOccurrenceEntity);
    const applications = dataSource.getRepository(EventParticipationEntity);
    const readApplication = (id: string) => applications.findOneByOrFail({ id });

    await lifecycle.execute();
    expect(await readApplication(pending.id)).toMatchObject({ status: 'PENDING' });

    cutoff = start;
    await lifecycle.execute();
    expect(await readApplication(pending.id)).toMatchObject({
      status: 'NOT_CONSIDERED',
      statusUpdatedAt: start,
      applicationMessage: 'Hello'
    });
    expect(await readApplication(approved.id)).toMatchObject({ status: 'APPROVED' });
    expect(await readApplication(rejected.id)).toMatchObject({ status: 'REJECTED' });
    expect(await readApplication(cancelledApplication.participation.id)).toMatchObject({
      status: 'PENDING'
    });
    expect(await events.findOneByOrFail({ id: event.id })).toMatchObject({ status: 'FULL' });
    const occurrence = await occurrences.findOneByOrFail({ eventId: event.id });
    expect(occurrence.status).toBe('FULL');

    cutoff = end;
    await lifecycle.execute();
    expect(await events.findOneByOrFail({ id: event.id })).toMatchObject({
      status: 'COMPLETED',
      updatedAt: end
    });
    expect(await occurrences.findOneByOrFail({ id: occurrence.id })).toMatchObject({
      status: 'COMPLETED',
      updatedAt: end
    });
    expect(await events.findOneByOrFail({ id: draft.id })).toMatchObject({ status: 'DRAFT' });
    expect(await events.findOneByOrFail({ id: cancelled.id })).toMatchObject({ status: 'CANCELLED' });
    expect(await occurrences.findOneByOrFail({ eventId: cancelled.id })).toMatchObject({
      status: 'CANCELLED'
    });

    cutoff = new Date(end.getTime() + 60_000);
    await lifecycle.execute();
    expect(await readApplication(pending.id)).toMatchObject({ statusUpdatedAt: start });
    expect(await events.findOneByOrFail({ id: event.id })).toMatchObject({ updatedAt: end });
    expect(await occurrences.findOneByOrFail({ id: occurrence.id })).toMatchObject({ updatedAt: end });
  });

  it('skips locked events and rolls back all lifecycle writes if a batch fails', async () => {
    const [owner, applicant] = await Promise.all([createUser(), createUser()]);
    const locked = await publishForFeed(owner, { participationMode: 'REQUEST' });
    const due = await publishForFeed(owner, { participationMode: 'REQUEST' });
    const { participation } = await manageParticipation.join(applicant, locked.id);
    const { participation: dueApplication } = await manageParticipation.join(applicant, due.id);
    const cutoff = new Date('2026-11-26T14:00:00Z');
    const unitOfWork = new TypeOrmUnitOfWork(dataSource);
    const repository = new EventLifecycleRepositoryAdapter();
    const eventRepository = new EventRepositoryAdapter(dataSource.getRepository(EventEntity));
    const lifecycle = new AdvanceEventLifecycleUseCase(repository, unitOfWork, () => cutoff);
    const events = dataSource.getRepository(EventEntity);
    const occurrences = dataSource.getRepository(EventOccurrenceEntity);
    const applications = dataSource.getRepository(EventParticipationEntity);

    await occurrences.delete({ eventId: due.id });
    await unitOfWork.run(async (tx) => {
      await eventRepository.inTransaction(tx).lockEvent(locked.id);
      await lifecycle.execute();
      expect(await events.findOneByOrFail({ id: locked.id })).toMatchObject({ status: 'PUBLISHED' });
      expect(await events.findOneByOrFail({ id: due.id })).toMatchObject({ status: 'COMPLETED' });
      expect(await occurrences.findOneByOrFail({ eventId: due.id })).toMatchObject({
        status: 'COMPLETED'
      });
      expect(await applications.findOneByOrFail({ id: dueApplication.id })).toMatchObject({
        status: 'NOT_CONSIDERED'
      });
    });

    const failure = new Error('Abort lifecycle transaction');
    await expect(
      unitOfWork.run(async (tx) => {
        await repository.advanceDueEvents(cutoff, 100, tx);
        throw failure;
      })
    ).rejects.toBe(failure);
    expect(await events.findOneByOrFail({ id: locked.id })).toMatchObject({ status: 'PUBLISHED' });
    expect(await occurrences.findOneByOrFail({ eventId: locked.id })).toMatchObject({
      status: 'SCHEDULED'
    });
    expect(await applications.findOneByOrFail({ id: participation.id })).toMatchObject({
      status: 'PENDING'
    });

    await lifecycle.execute();
    expect(await events.findOneByOrFail({ id: locked.id })).toMatchObject({ status: 'COMPLETED' });
    expect(await occurrences.findOneByOrFail({ eventId: locked.id })).toMatchObject({
      status: 'COMPLETED'
    });
    expect(await applications.findOneByOrFail({ id: participation.id })).toMatchObject({
      status: 'NOT_CONSIDERED'
    });
  });

  it('serves one level of replies, enforces comment permissions and archives discussions', async () => {
    const [owner, participant, outsider, adminUser] = await Promise.all([
      createUser(),
      createUser(),
      createUser(),
      createUser()
    ]);
    const admin: AuthUser = { ...adminUser, role: 'ADMIN' };
    const event = await publishForFeed(owner, {});
    const otherEvent = await publishForFeed(owner, {});
    await manageParticipation.join(participant, event.id);
    const openUntil = new Date(Date.now() + 60 * 60 * 1000);
    const events = dataSource.getRepository(EventEntity);
    await events.update([event.id, otherEvent.id], {
      firstStartsAt: new Date(openUntil.getTime() - 30 * 60 * 1000),
      firstEndsAt: openUntil
    });
    const api = createEventsTestApi([owner, participant, outsider, admin]);
    const path = `/events/${event.id}/comments`;
    const list = (user?: AuthUser) => api.get(path).set('X-Test-User', user?.id ?? '');
    const post = (user: AuthUser, text: string, parentId?: string) =>
      api.post(path).set('X-Test-User', user.id).send({ text, parentId });

    await api.post(path).send({ text: 'Guest comment' }).expect(401);
    await post(admin, 'Administrative account').expect(403);
    const unverifiedApi = createEventsTestApi([{ ...outsider, emailVerified: false }]);
    await unverifiedApi.post(path).set('X-Test-User', outsider.id)
      .send({ text: 'Unverified account' }).expect(403);
    const eligibleVisitor = await api.post(`/events/${otherEvent.id}/comments`)
      .set('X-Test-User', outsider.id).send({ text: 'A visitor with a verified account' }).expect(201);
    expect(eligibleVisitor.body.data.isOrganizer).toBe(false);
    await post(owner, '  ').expect(400);
    const root = (await post(owner, '  First comment  ').expect(201)).body.data;
    expect(root).toMatchObject({
      text: 'First comment', parentId: null, author: { id: owner.id }, isOrganizer: true
    });
    expect(root.author).not.toHaveProperty('email');
    const reply = (await post(participant, 'A reply', root.id).expect(201)).body.data;
    await post(owner, 'A nested reply', reply.id).expect(422);
    await api
      .post(`/events/${otherEvent.id}/comments`)
      .set('X-Test-User', owner.id)
      .send({ text: 'Wrong event', parentId: root.id })
      .expect(404);

    const secondRoot = (await post(participant, 'Another comment').expect(201)).body.data;
    const firstPage = await list().query({ limit: 1 }).expect(200);
    expect(firstPage.body.pagination).toEqual({ nextCursor: root.id, hasMore: true });
    const secondPage = await list().query({ cursor: root.id, limit: 1 }).expect(200);
    expect(secondPage.body.data).toMatchObject([{ id: secondRoot.id }]);
    expect(secondPage.body.pagination).toEqual({ nextCursor: null, hasMore: false });
    const thread = await list().query({ parentId: root.id }).expect(200);
    expect(thread.body.data).toMatchObject([{ id: reply.id, parentId: root.id }]);
    const blocks = dataSource.getRepository(UserBlockEntity);
    await blocks.insert({ blockerId: outsider.id, blockedId: participant.id });
    const filteredThread = await list(outsider).query({ parentId: root.id }).expect(200);
    expect(filteredThread.body.data).toEqual([]);
    const outsiderReply = (await post(outsider, 'Reply from the blocker', root.id).expect(201))
      .body.data;
    const reverseThread = await list(participant).query({ parentId: root.id }).expect(200);
    expect(reverseThread.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: outsiderReply.id })])
    );

    const replyPath = `${path}/${reply.id}`;
    await api.delete(`${path}/${root.id}`).set('X-Test-User', outsider.id).expect(403);
    await api.patch(replyPath).set('X-Test-User', owner.id).send({ text: 'Changed' }).expect(403);
    const edited = await api
      .patch(replyPath)
      .set('X-Test-User', participant.id)
      .send({ text: 'Updated reply' })
      .expect(200);
    expect(edited.body.data).toMatchObject({ text: 'Updated reply', isEdited: true });
    await api.delete(replyPath).set('X-Test-User', outsider.id).expect(404);
    await api.delete(replyPath).set('X-Test-User', owner.id).expect(204);
    await api.delete(`${path}/${outsiderReply.id}`).set('X-Test-User', outsider.id).expect(204);
    await api.delete(`${path}/${secondRoot.id}`).set('X-Test-User', participant.id).expect(204);
    await api.patch(replyPath).set('X-Test-User', participant.id).send({ text: 'Changed' }).expect(404);
    const afterRemoval = await list().query({ parentId: root.id }).expect(200);
    expect(afterRemoval.body.data).toEqual([]);
    await list(admin).query({ archive: true }).expect(404);

    const end = new Date(Date.now() - 1);
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    await events.update(event.id, { firstStartsAt: start, firstEndsAt: end });
    await dataSource.getRepository(EventOccurrenceEntity).update(
      { eventId: event.id },
      { startsAt: start, endsAt: end }
    );
    await list().expect(404);
    await post(owner, 'The discussion has closed').expect(404);
    const lifecycle = new AdvanceEventLifecycleUseCase(
      new EventLifecycleRepositoryAdapter(),
      new TypeOrmUnitOfWork(dataSource),
      () => end
    );
    await lifecycle.execute();
    await list().query({ archive: true }).expect(401);
    await list(owner).query({ archive: true }).expect(403);
    const archivedRoots = await list(admin).query({ archive: true }).expect(200);
    expect(archivedRoots.body.data).toMatchObject([
      { id: root.id, isArchived: true },
      { id: secondRoot.id, isArchived: true }
    ]);
    const archivedThread = await list(admin).query({ archive: true, parentId: root.id }).expect(200);
    expect(archivedThread.body.data).toHaveLength(2);
    expect(archivedThread.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: reply.id, isArchived: true, text: 'Updated reply' }),
      expect.objectContaining({
        id: outsiderReply.id,
        isArchived: true,
        text: 'Reply from the blocker'
      })
    ]));
  });

  it('enforces the rolling comment quota across events and concurrent requests', async () => {
    const owner = await createUser();
    const first = await publishForFeed(owner, {});
    const second = await publishForFeed(owner, {});
    const now = Date.now();
    await dataSource.getRepository(EventEntity).update([first.id, second.id], {
      firstStartsAt: new Date(now + 30 * 60 * 1000),
      firstEndsAt: new Date(now + 60 * 60 * 1000)
    });
    const api = createEventsTestApi([owner]);
    const post = (id: string) =>
      api.post(`/events/${id}/comments`).set('X-Test-User', owner.id).send({ text: 'New comment' });
    await post(first.id).expect(201);
    await api.delete(`/events/${first.id}`).set('X-Test-User', owner.id).expect(204);
    expect(await dataSource.getRepository(DiscussionCommentEntity).countBy({ eventId: first.id }))
      .toBe(0);
    const responses = await Promise.all(Array.from({ length: 20 }, () => post(second.id)));
    expect(responses.filter(({ status }) => status === 201)).toHaveLength(19);
    expect(responses.filter(({ status }) => status === 429)).toHaveLength(1);

    const quotas = dataSource.getRepository(DiscussionCommentQuotaEntity);
    const { postedAt } = await quotas.findOneByOrFail({ authorId: owner.id });
    await quotas.update(owner.id, {
      postedAt: [new Date(now - 60 * 60 * 1000), ...postedAt.slice(1)]
    });
    await post(second.id).expect(201);
    await post(second.id).expect(429);
  });

  it('publishes one review per approved attendee and includes visible ratings in public views', async () => {
    const [owner, first, second, third, outsider] = await Promise.all([
      createUser(),
      createUser(),
      createUser(),
      createUser(),
      createUser()
    ]);
    const event = await publishForFeed(owner, {});
    const other = await publishForFeed(owner, {});
    const overdue = await publishForFeed(owner, {});
    for (const [viewer, eventId] of [
      [first, event.id],
      [second, event.id],
      [third, other.id],
      [first, other.id],
      [first, overdue.id]
    ] as const) {
      await manageParticipation.join(viewer, eventId);
    }

    const api = createEventsTestApi([owner, first, second, third, outsider]);
    const submit = (eventId: string, author: AuthUser, rating: number, text?: string) =>
      api.post(`/events/${eventId}/reviews`).set('X-Test-User', author.id).send({ rating, text });
    const profilePath = `/users/${owner.id}`;
    await submit(event.id, first, 5).expect(404);

    const events = dataSource.getRepository(EventEntity);
    const hour = 60 * 60 * 1000;
    const recentEnd = Date.now() - hour;
    await events.update([event.id, other.id], {
      status: 'COMPLETED',
      firstStartsAt: new Date(recentEnd - hour),
      firstEndsAt: new Date(recentEnd)
    });
    await events.update(overdue.id, {
      status: 'COMPLETED',
      firstStartsAt: new Date(recentEnd - 8 * 24 * hour),
      firstEndsAt: new Date(recentEnd - 7 * 24 * hour)
    });

    await api.post(`/events/${event.id}/reviews`).send({ rating: 5 }).expect(401);
    await submit(event.id, outsider, 5).expect(403);
    await submit(event.id, owner, 5).expect(403);
    await submit(event.id, first, 6).expect(400);
    await submit(overdue.id, first, 5).expect(409);
    const eligible = await api.get(`/events/${event.id}`).set('X-Test-User', first.id).expect(200);
    expect(eligible.body.data.actions.canReview).toBe(true);

    const duplicates = await Promise.all([
      submit(event.id, first, 5, '  Great event  '),
      submit(event.id, first, 5, '  Great event  ')
    ]);
    expect(duplicates.map(({ status }) => status).sort()).toEqual([201, 409]);
    const firstReview = duplicates.find(({ status }) => status === 201)?.body.data;
    expect(firstReview).toMatchObject({
      rating: 5,
      text: 'Great event',
      author: { id: first.id },
      organizerReply: null,
      organizerReplyAt: null
    });
    expect(firstReview.author).not.toHaveProperty('email');
    const reviewed = await api.get(`/events/${event.id}`).set('X-Test-User', first.id).expect(200);
    expect(reviewed.body.data.actions.canReview).toBe(false);
    const secondReview = (await submit(event.id, second, 4).expect(201)).body.data;
    const belowThreshold = await api.get(profilePath).expect(200);
    expect(belowThreshold.body.data).toMatchObject({ rating: null, ratingCount: 2 });
    expect(belowThreshold.body.data).not.toHaveProperty('email');

    const thirdReview = (await submit(other.id, third, 2).expect(201)).body.data;
    const threshold = await api.get(profilePath).expect(200);
    expect(threshold.body.data).toMatchObject({ rating: 3.7, ratingCount: 3 });
    const fourthReview = (await submit(other.id, first, 1).expect(201)).body.data;
    const card = await api.get(`/events/${event.id}`).expect(200);
    expect(card.body.data.organizer).toMatchObject({ rating: 3, ratingCount: 4 });
    expect(card.body.data).toMatchObject({ rating: 4.5, ratingCount: 2 });
    expect(card.body.data.reviews.data.map(({ id }: { id: string }) => id).sort())
      .toEqual([firstReview.id, secondReview.id].sort());
    const reviewPath = `/events/${event.id}/reviews/${firstReview.id}`;
    await api.patch(reviewPath).set('X-Test-User', owner.id).send({ rating: 1 }).expect(403);
    const edited = await api.patch(reviewPath).set('X-Test-User', first.id)
      .send({ rating: 3, text: null }).expect(200);
    expect(edited.body.data).toMatchObject({ rating: 3, text: null });
    const updatedCard = await api.get(`/events/${event.id}`).expect(200);
    expect(updatedCard.body.data).toMatchObject({ rating: 3.5, ratingCount: 2 });
    await api.patch(reviewPath).set('X-Test-User', first.id).send({ rating: 5 }).expect(200);

    const upcoming = await publishForFeed(owner, {});
    await events.update(upcoming.id, {
      firstStartsAt: new Date(Date.now() + hour),
      firstEndsAt: new Date(Date.now() + 2 * hour)
    });
    const upcomingCard = await api.get(`/events/${upcoming.id}`).expect(200);
    expect(upcomingCard.body.data.organizerReviews.data).toHaveLength(3);
    expect(upcomingCard.body.data.organizerReviews.data[0].eventTitle).toBe(event.title);

    const reply = (author: AuthUser) =>
      api
        .post(`/events/${event.id}/reviews/${firstReview.id}/reply`)
        .set('X-Test-User', author.id)
        .send({ text: 'Thank you' });
    await reply(first).expect(404);
    const replied = await reply(owner).expect(200);
    expect(replied.body.data).toMatchObject({
      organizerReply: 'Thank you',
      organizerReplyAt: expect.any(String)
    });
    await reply(owner).expect(409);

    const targets = [firstReview, secondReview, thirdReview, fourthReview];
    const pin = (target: { eventId: string; id: string }, isPinned: boolean) =>
      api
        .put(`/events/${target.eventId}/reviews/${target.id}/pin`)
        .set('X-Test-User', owner.id)
        .send({ isPinned });
    const pinned = await Promise.all(targets.map((target) => pin(target, true)));
    expect(pinned.map(({ status }) => status).sort()).toEqual([200, 200, 200, 409]);
    const rejectedPin = targets[pinned.findIndex(({ status }) => status === 409)];
    const acceptedPin = targets[pinned.findIndex(({ status }) => status === 200)];
    await pin(acceptedPin, false).expect(200);
    await pin(rejectedPin, true).expect(200);
    const profile = await api.get(profilePath).expect(200).expect('Cache-Control', 'private, no-store');
    expect(profile.body.data.reviews.data).toHaveLength(3);
    expect(profile.body.data.reviews.data.every(({ isPinned }: { isPinned: boolean }) => isPinned))
      .toBe(true);
    const nextPage = await api
      .get(`${profilePath}/reviews`)
      .query({ cursor: profile.body.data.reviews.pagination.nextCursor })
      .expect(200);
    expect(nextPage.body.data).toMatchObject([{ id: acceptedPin.id, isPinned: false }]);
    expect(nextPage.body.pagination).toEqual({ nextCursor: null, hasMore: false });

    const reviews = dataSource.getRepository(EventReviewEntity);
    await reviews.update(fourthReview.id, { isHiddenByAdmin: true });
    const moderated = await api.get(profilePath).expect(200);
    expect(moderated.body.data).toMatchObject({ rating: 3.7, ratingCount: 3 });
    expect(moderated.body.data.reviews.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: fourthReview.id })])
    );
    await dataSource.getRepository(UserBlockEntity).insert({
      blockerId: outsider.id,
      blockedId: first.id
    });
    const filtered = await api
      .get(`/events/${event.id}/reviews`)
      .set('X-Test-User', outsider.id)
      .expect(200);
    expect(filtered.body.data).toMatchObject([{ id: secondReview.id }]);
    await events.update(other.id, { isHiddenByAdmin: true });
    const hiddenEvent = await api.get(profilePath).expect(200);
    expect(hiddenEvent.body.data).toMatchObject({ rating: null, ratingCount: 2 });
    expect(hiddenEvent.body.data.reviews.data).toHaveLength(2);
    await events.update(event.id, {
      firstStartsAt: new Date(recentEnd - 8 * 24 * hour),
      firstEndsAt: new Date(recentEnd - 7 * 24 * hour)
    });
    await api.patch(reviewPath).set('X-Test-User', first.id).send({ rating: 1 }).expect(409);
  });

  it('queues event notifications transactionally and honors email preferences at delivery', async () => {
    const [owner, attendee, applicant] = await Promise.all([createUser(), createUser(), createUser()]);
    const delivered: string[] = [];
    let failDelivery = true;
    const { api, notifications } = createEventsTestContext([owner, attendee, applicant], async ({ to }) => {
      if (failDelivery) throw new Error('SMTP unavailable');
      delivered.push(to);
    });
    const event = await publishForFeed(owner, { participationMode: 'REQUEST' });
    const events = dataSource.getRepository(EventEntity);
    const hour = 60 * 60 * 1000;
    const start = new Date(Date.now() + 6 * hour);
    const end = new Date(start.getTime() + hour);
    await events.update(event.id, { firstStartsAt: start, firstEndsAt: end });
    await dataSource.getRepository(EventOccurrenceEntity).update(
      { eventId: event.id },
      { startsAt: start, endsAt: end }
    );
    const join = (user: AuthUser) =>
      api.post(`/events/${event.id}/participations`).set('X-Test-User', user.id).send({});
    const joined = await join(attendee).expect(200);
    await join(attendee).expect(200);
    await join(applicant).expect(200);
    const approve = () => api
      .post(`/events/${event.id}/applications/${joined.body.data.participation.id}/approve`)
      .set('X-Test-User', owner.id);
    await approve().expect(200);
    await approve().expect(200);

    const inbox = (user: AuthUser) => api.get('/notifications').set('X-Test-User', user.id);
    await api.get('/notifications').expect(401);
    const organizerInbox = await inbox(owner).query({ limit: 1 }).expect(200);
    expect(organizerInbox.body.data).toMatchObject([{ type: 'NEW_APPLICATION', targetId: event.id }]);
    expect(organizerInbox.body.pagination.hasMore).toBe(true);
    const organizerNext = await inbox(owner)
      .query({ limit: 1, cursor: organizerInbox.body.pagination.nextCursor })
      .expect(200);
    expect(organizerNext.body.pagination).toEqual({ nextCursor: null, hasMore: false });
    const attendeeInbox = await inbox(attendee).expect(200);
    expect(attendeeInbox.body.data).toMatchObject([{ type: 'APPLICATION_APPROVED', isRead: false }]);
    const notificationId = attendeeInbox.body.data[0].id;
    await api.patch(`/notifications/${notificationId}/read`).set('X-Test-User', applicant.id).expect(404);
    await api.patch(`/notifications/${notificationId}/read`).set('X-Test-User', attendee.id).expect(204);

    const rows = dataSource.getRepository(NotificationEntity);
    await notifications.startDeliveryWorker()();
    const failed = await rows.findOneByOrFail({ id: notificationId });
    expect(failed).toMatchObject({ isRead: true, emailAttempts: 1, emailDueAt: expect.any(Date) });
    expect(failed.emailDueAt?.getTime()).toBeGreaterThan(Date.now());
    failDelivery = false;
    await rows.update(notificationId, { emailDueAt: new Date(0) });
    await notifications.startDeliveryWorker()();
    expect(delivered).toEqual([attendee.email]);
    expect(await rows.findOneByOrFail({ id: notificationId })).toMatchObject({ emailDueAt: null });

    await api.patch('/notifications/preferences').set('X-Test-User', attendee.id)
      .send({ emailEnabled: false }).expect(200);
    const preferences = await api.get('/notifications/preferences').set('X-Test-User', attendee.id).expect(200);
    expect(preferences.body.data).toEqual({ emailEnabled: false });

    await api.patch(`/events/${event.id}`).set('X-Test-User', owner.id)
      .send({ onlineUrl: 'https://example.com/updated-meeting' }).expect(200);
    expect(await rows.countBy({ type: 'EVENT_CHANGED', recipientId: attendee.id, targetId: event.id }))
      .toBe(1);

    let cutoff = new Date();
    const lifecycle = new AdvanceEventLifecycleUseCase(
      new EventLifecycleRepositoryAdapter(notifications.publisher),
      new TypeOrmUnitOfWork(dataSource),
      () => cutoff
    );
    await lifecycle.execute();
    await lifecycle.execute();
    const reminder = await rows.findOneByOrFail({
      recipientId: attendee.id, type: 'EVENT_REMINDER_24H', targetId: event.id
    });
    expect(await rows.countBy({ type: 'EVENT_REMINDER_24H', targetId: event.id })).toBe(1);
    expect(await rows.countBy({ recipientId: applicant.id, targetId: event.id })).toBe(0);
    await rows.update(reminder.id, { emailDueAt: new Date(0) });
    await notifications.startDeliveryWorker()();
    expect(delivered).toEqual([attendee.email]);

    cutoff = end;
    await lifecycle.execute();
    await lifecycle.execute();
    expect(await rows.countBy({ type: 'REVIEW_REMINDER', targetId: event.id })).toBe(1);
    expect(await rows.findOneByOrFail({ type: 'REVIEW_REMINDER', targetId: event.id })).toMatchObject({
      recipientId: attendee.id, emailDueAt: null
    });

    const cancelled = await publishForFeed(owner, { participationMode: 'REQUEST' });
    await events.update(cancelled.id, { firstStartsAt: start, firstEndsAt: end });
    for (const user of [attendee, applicant]) {
      await api.post(`/events/${cancelled.id}/participations`)
        .set('X-Test-User', user.id).send({}).expect(200);
    }
    await api.post(`/events/${cancelled.id}/cancel`).set('X-Test-User', owner.id)
      .send({ reason: 'Weather' }).expect(200);
    const cancellations = await rows.findBy({ type: 'EVENT_CANCELLED', targetId: cancelled.id });
    expect(cancellations.map(({ recipientId }) => recipientId).sort())
      .toEqual([attendee.id, applicant.id].sort());
    expect(cancellations.map(({ message }) => message)).toEqual([
      expect.stringContaining('Weather'), expect.stringContaining('Weather')
    ]);
  });

  it('shares full profiles with the organizer and approved participants', async () => {
    const [owner, applicant, attendee, outsider, staff] = await Promise.all([
      createUser(), createUser(), createUser(), createUser(), createUser()
    ]);
    const admin = { ...staff, role: 'ADMIN' as const };
    const api = createEventsTestApi([owner, applicant, attendee, outsider, admin]);
    const event = await publishForFeed(owner, { participationMode: 'REQUEST' });
    const first = (await manageParticipation.join(applicant, event.id, 'Hello')).participation;
    const second = (await manageParticipation.join(attendee, event.id)).participation;
    await manageParticipation.decide(owner, event.id, second.id, 'APPROVED');
    await dataSource.getRepository(UserEntity).update(applicant.id, {
      cityId: kyivId,
      bio: 'Люблю настільні ігри',
      languages: ['uk'],
      socialLinks: { website: 'https://example.com', legacy: 'javascript:void(0)' }
    });
    const applications = `/events/${event.id}/applications`;
    const participants = `/events/${event.id}/participants`;
    const get = (path: string, user: AuthUser) => api.get(path).set('X-Test-User', user.id);
    await api.get(participants).expect(401);
    await get(applications, attendee).expect(404);
    await get(participants, applicant).expect(403);
    await get(participants, outsider).expect(403);
    const pending = await get(applications, owner).expect(200);
    const profile = pending.body.data[0].user;
    expect(profile).toMatchObject({
      id: applicant.id,
      age: expect.any(Number),
      cityId: kyivId,
      bio: 'Люблю настільні ігри',
      languages: ['uk'],
      socialLinks: { website: 'https://example.com' }
    });
    expect(profile.socialLinks).not.toHaveProperty('legacy');
    expect(profile).not.toHaveProperty('birthDate');
    expect(profile).not.toHaveProperty('email');
    await manageParticipation.decide(owner, event.id, first.id, 'APPROVED');
    for (const viewer of [attendee, admin]) {
      const roster = await get(participants, viewer).expect(200);
      expect(roster.body.data.find(({ user }: { user: { id: string } }) => user.id === applicant.id)?.user)
        .toEqual(profile);
    }
    await dataSource.getRepository(UserBlockEntity).insert({
      blockerId: applicant.id,
      blockedId: attendee.id
    });
    const filtered = await get(participants, attendee).expect(200);
    expect(filtered.body.data.map(({ user }: { user: { id: string } }) => user.id))
      .toEqual([attendee.id]);
  });

  it('paginates public organizer history and filters age, hidden events, and blocks', async () => {
    const [owner, viewer] = await Promise.all([createUser(), createUser()]);
    const api = createEventsTestApi([owner, viewer]);
    const [first, second, restricted, hidden, cancelled, future] = await Promise.all([
      publishForFeed(owner, {}),
      publishForFeed(owner, {}),
      publishForFeed(owner, { ageRestriction: 'EIGHTEEN_PLUS' }),
      publishForFeed(owner, {}),
      publishForFeed(owner, {}),
      publishForFeed(owner, {})
    ]);
    const events = dataSource.getRepository(EventEntity);
    await events.update([first.id, second.id, restricted.id, hidden.id], { status: 'COMPLETED' });
    await events.update(hidden.id, { isHiddenByAdmin: true });
    await events.update(cancelled.id, { status: 'CANCELLED' });
    const path = `/users/${owner.id}`;
    const expected = [first.id, second.id].sort().reverse();
    const profile = await api.get(path).expect(200);
    expect(profile.body.data).not.toHaveProperty('age');
    expect(profile.body.data.history.data.map(({ id }: { id: string }) => id)).toEqual(expected);
    const page = await api.get(`${path}/events`).query({ limit: 1 }).expect(200);
    expect(page.body.pagination).toEqual({ nextCursor: expected[0], hasMore: true });
    expect(page.body.data[0]).not.toHaveProperty('onlineUrl');
    expect(page.body.data[0]).not.toHaveProperty('primaryLocationId');
    const next = await api.get(`${path}/events`).query({ limit: 1, cursor: expected[0] }).expect(200);
    expect(next.body.data).toMatchObject([{ id: expected[1] }]);
    expect(next.body.pagination).toEqual({ nextCursor: null, hasMore: false });
    const authenticated = await api.get(path).set('X-Test-User', viewer.id).expect(200);
    expect(authenticated.body.data.age).toEqual(expect.any(Number));
    expect(authenticated.body.data.history.data.map(({ id }: { id: string }) => id).sort())
      .toEqual([...expected, restricted.id].sort());
    expect(authenticated.body.data.history.data.map(({ id }: { id: string }) => id))
      .not.toContain(future.id);
    await dataSource.getRepository(UserBlockEntity).insert({ blockerId: owner.id, blockedId: viewer.id });
    await api.get(`${path}/events`).set('X-Test-User', viewer.id).expect(404);
  });

  it('edits the private profile while enforcing immutable and required fields', async () => {
    const user = await createUser();
    const api = createEventsTestApi([user]);
    const { interests } = createDictionariesModule({ dataSource });
    const interestIds = (await interests.listActive()).slice(0, 3).map(({ id }) => id);
    const path = '/users/me/profile';
    const patch = (body: object) => api.patch(path).set('X-Test-User', user.id).send(body);
    await api.get(path).expect(401);
    await patch({ birthDate: '1999-01-01' }).expect(400);
    await patch({ cityId: randomUUID() }).expect(422);
    await patch({ interestIds: [interestIds[0], interestIds[0], interestIds[1]] }).expect(422);
    await patch({
      name: '  Олена  ',
      cityId: kyivId,
      interestIds,
      bio: 'Люблю настільні ігри',
      languages: ['uk'],
      socialLinks: { website: 'https://example.com' }
    }).expect(204);
    const profile = await api.get(path).set('X-Test-User', user.id).expect(200);
    expect(profile.body.data).toMatchObject({
      name: 'Олена',
      birthDate: '2000-01-01',
      cityId: kyivId,
      bio: 'Люблю настільні ігри',
      languages: ['uk'],
      socialLinks: { website: 'https://example.com' }
    });
    expect([...profile.body.data.interestIds].sort()).toEqual([...interestIds].sort());
    await patch({ bio: null }).expect(204);
    await dataSource.getRepository(UserEntity).update(user.id, { emailVerified: false });
    await patch({ name: 'Інше ім’я' }).expect(403);
  });

  it('changes email only after confirmation by the account that requested it', async () => {
    const [user, other] = await Promise.all([createUser(), createUser()]);
    const users = createUsersModule({ dataSource });
    const tokens = new JwtTokenService();
    const { requireAuth } = createAuthMiddleware({ tokenService: tokens, users: users.authUsers, access: users.access });
    const messages: { email: string; token: string }[] = [];
    const previousAddresses: string[] = [];
    const changeEmail = new ChangeEmailUseCase(
      new TypeOrmEmailChangeStore(dataSource),
      new JwtEmailChangeTokens('test-only-email-change-secret'),
      async (email, token) => { messages.push({ email, token }); },
      async (email) => { previousAddresses.push(email); }
    );
    const app = express();
    app.use(express.json());
    app.use(createEmailChangeRouter(
      requireAuth,
      changeEmail,
      {
        async execute({ email, password }) {
          const account = await users.authUsers.findByEmail(email);
          if (!account || password !== 'valid-password') throw new AppError('Invalid credentials', 401);
          return account;
        }
      },
      { async verify() { throw new Error('Passkey verification was not expected'); } }
    ));
    app.use(errorHandler);
    const api = request(app);
    const [ownerToken, otherToken] = await Promise.all(
      [user, other].map(({ id }) => tokens.signAccessToken({ userId: id }))
    );
    const start = (email: string, password = 'valid-password') =>
      api.post('/change-email').set('Authorization', `Bearer ${ownerToken}`)
        .send({ email, proof: { method: 'password', password } });
    const confirm = (session: string, token: string) =>
      api.post('/change-email/confirm').set('Authorization', `Bearer ${session}`).send({ token });
    await start(other.email).expect(409);
    const email = `${randomUUID()}@example.net`;
    await start(email, 'incorrect-password').expect(401);
    await start(email.toUpperCase()).expect(202);
    expect(messages).toEqual([{ email, token: expect.any(String) }]);
    expect((await users.authUsers.findById(user.id))?.email).toBe(user.email);
    const { token } = messages[0];
    await confirm(otherToken, token).expect(400);
    await confirm(ownerToken, token).expect(204);
    expect(previousAddresses).toEqual([user.email]);
    await confirm(ownerToken, token).expect(400);
    expect(await users.authUsers.findById(user.id)).toMatchObject({ email, emailVerified: true });
    expect(await users.authUsers.findByEmail(user.email)).toBeNull();
  });

  it('cancels upcoming events on account deletion, restores once, and anonymizes expired accounts', async () => {
    const [owner, attendee] = await Promise.all([createUser(), createUser()]);
    const upcoming = await publishForFeed(owner, {});
    const completed = await publishForFeed(attendee, {});
    const discussionEvent = await publishForFeed(attendee, {});
    await dataSource.getRepository(EventEntity).update(discussionEvent.id, {
      firstStartsAt: new Date(Date.now() + 30 * 60_000),
      firstEndsAt: new Date(Date.now() + 60 * 60_000)
    });
    await manageParticipation.join(attendee, upcoming.id);
    await dataSource.getRepository(EventEntity).update(completed.id, { status: 'COMPLETED' });
    const reviews = dataSource.getRepository(EventReviewEntity);
    await reviews.insert({ eventId: completed.id, authorId: owner.id, rating: 5 });
    await dataSource.getRepository(DiscussionCommentEntity).insert({
      eventId: discussionEvent.id,
      authorId: owner.id,
      text: 'A previous comment'
    });
    const users = createUsersModule({ dataSource });
    const tokens = new JwtTokenService();
    const auth = createAuthModule({
      dataSource,
      users: users.authUsers,
      access: users.access,
      profiles: users.profiles
    });
    const password = 'A valid password 123';
    await dataSource.getRepository(PasswordCredentialEntity).insert({
      userId: owner.id,
      passwordHash: await new BcryptPasswordHasher().hash(password)
    });
    const received: string[] = [];
    const { api, events, notifications } = createEventsTestContext([owner, attendee], async (mail) => {
      if (mail.to === owner.email) received.push(mail.message);
    });
    const removedImages: string[] = [];
    let cleanupAttempts = 0;
    let clock = now;
    const accounts = users.createAccountDeletion(
      events,
      notifications.publisher,
      async (id) => {
        cleanupAttempts++;
        if (cleanupAttempts === 1) throw new Error('Temporary storage outage');
        removedImages.push(id);
      },
      () => clock
    );
    const app = express();
    app.use(express.json());
    app.use(auth.createAccountDeletionRouter(accounts));
    app.use(errorHandler);
    const accountApi = request(app);
    const originalToken = await tokens.signAccessToken({ userId: owner.id });
    const sessionId = randomUUID();
    await dataSource.query(
      'INSERT INTO refresh_sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [sessionId, owner.id, 'a'.repeat(64), new Date(Date.now() + 3_600_000)]
    );
    const remove = (token: string, proof = { method: 'password', password }) =>
      accountApi.delete('/account').set('Authorization', `Bearer ${token}`).send({ proof });
    await accountApi.delete('/account').set('Authorization', `Bearer ${originalToken}`).expect(400);
    await remove(originalToken, { method: 'password', password: 'wrong' }).expect(401);
    expect((await users.authUsers.findById(owner.id))?.status).toBe('ACTIVE');
    const pending = await remove(originalToken).expect(202);
    const recoveryDeadline = new Date(pending.body.data.recoverUntil);
    expect(recoveryDeadline.getTime() - now.getTime()).toBe(30 * 86_400_000);
    const [session] = await dataSource.query<{ revoked_at: Date }[]>(
      'SELECT revoked_at FROM refresh_sessions WHERE id = $1', [sessionId]
    );
    expect(session.revoked_at).toEqual(now);
    const eventRows = dataSource.getRepository(EventEntity);
    expect(await eventRows.findOneByOrFail({ id: upcoming.id })).toMatchObject({ status: 'CANCELLED' });
    expect(await dataSource.getRepository(EventOccurrenceEntity).findOneByOrFail({ eventId: upcoming.id }))
      .toMatchObject({ status: 'CANCELLED' });
    await api.get(`/users/${owner.id}`).expect(404);
    const inbox = await api.get('/notifications').set('X-Test-User', attendee.id).expect(200);
    expect(inbox.body.data).toMatchObject([{ type: 'EVENT_CANCELLED', targetId: upcoming.id }]);
    for (let attempt = 0; attempt < 50 && received.length === 0; attempt++) {
      await notifications.startDeliveryWorker()();
    }
    const link = received.find((message) => message.includes('Відновити акаунт: '))
      ?.split('Відновити акаунт: ')[1];
    expect(link).toBeDefined();
    const recoveryToken = new URLSearchParams(new URL(link!).hash.slice(1)).get('token');
    await accountApi.post('/account/restore').send({ token: recoveryToken }).expect(204);
    await accountApi.post('/account/restore').send({ token: recoveryToken }).expect(400);
    await remove(originalToken).expect(401);
    await api.get(`/users/${owner.id}`).expect(200);
    expect(await eventRows.findOneByOrFail({ id: upcoming.id })).toMatchObject({ status: 'CANCELLED' });

    clock = new Date(now.getTime() + 1000);
    const restoredUser = await users.authUsers.findById(owner.id);
    const freshToken = await tokens.signAccessToken({
      userId: owner.id,
      sessionVersion: restoredUser?.sessionVersion
    });
    if (!restoredUser) throw new Error('Restored account missing');
    const challenges = new PasskeyChallengeRepositoryAdapter(dataSource.getRepository(PasskeyChallengeEntity));
    let emailCode = '';
    const enrollmentCodes = new AccountEmailCodeUseCase(challenges, 'ENROLLMENT_EMAIL', async (_email, code) => {
      emailCode = code;
    });
    const deletionCodes = new AccountEmailCodeUseCase(challenges, 'DELETION_EMAIL', async (_email, code) => {
      emailCode = code;
    });
    const removeWithEmail = () => accountApi.delete('/account')
      .set('Authorization', `Bearer ${freshToken}`).send({ proof: { method: 'email', code: emailCode } });
    await enrollmentCodes.requestCode(restoredUser);
    await removeWithEmail().expect(400);
    await deletionCodes.requestCode(restoredUser);
    const second = await removeWithEmail().expect(202);
    const secondLink = await createAccountRecoveryLink(owner.id, clock);
    const secondToken = new URLSearchParams(new URL(secondLink).hash.slice(1)).get('token');
    clock = new Date(second.body.data.recoverUntil);
    await accountApi.post('/account/restore').send({ token: secondToken }).expect(400);
    expect(await accounts.finalizeNext()).toBe(true);
    expect(await accounts.finalizeNext()).toBe(false);
    expect(cleanupAttempts).toBe(1);
    expect(removedImages).toEqual([]);
    const userRows = dataSource.getRepository(UserEntity);
    expect(await userRows.findOneBy({ email: owner.email })).toBeNull();
    expect(await userRows.findOneByOrFail({ id: owner.id })).toMatchObject({
      status: 'DELETED', name: 'Видалений користувач', birthDate: null
    });
    clock = new Date(clock.getTime() + 5 * 60_000);
    expect(await accounts.finalizeNext()).toBe(true);
    expect(await accounts.finalizeNext()).toBe(false);
    expect(removedImages).toEqual([owner.id]);
    expect((await userRows.findOneByOrFail({ id: owner.id })).mediaCleanupAt).toBeNull();
    const archivedReviews = await api.get(`/events/${completed.id}/reviews`).expect(200);
    expect(archivedReviews.body.data).toMatchObject([{
      rating: 5,
      author: { id: null, name: 'Видалений користувач', avatarUrl: null }
    }]);
    const discussion = await api.get(`/events/${discussionEvent.id}/comments`)
      .set('X-Test-User', attendee.id).expect(200);
    expect(discussion.body.data).toMatchObject([{ text: 'A previous comment', author: null }]);
  });

  it('manages dictionary records as an admin and exposes active choices publicly', async () => {
    const [owner, staff] = await Promise.all([createUser(), createUser()]);
    const api = createEventsTestApi([owner, { ...staff, role: 'ADMIN' }]);
    const slug = `category-${randomUUID()}`;
    const category = { name: slug, slug, orderNum: 20, icon: '🎲' };
    const admin = (path: string) => api.get(path).set('X-Test-User', staff.id);
    await api.get('/admin/categories').expect(401);
    await api.post('/admin/categories').set('X-Test-User', owner.id).send(category).expect(403);
    const created = await api.post('/admin/categories')
      .set('X-Test-User', staff.id).send(category).expect(201);
    const categoryId = created.body.data.id;
    categoryIds.push(categoryId);
    expect(created.body.data).toMatchObject({ ...category, isActive: true });
    await api.post('/admin/categories').set('X-Test-User', staff.id).send(category).expect(409);
    const publicCategories = await api.get('/dictionaries/categories').expect(200);
    expect(publicCategories.body.data).toContainEqual(created.body.data);
    const event = await publishForFeed(owner, { categoryId });
    const changed = await api.patch(`/admin/categories/${categoryId}`).set('X-Test-User', staff.id)
      .send({ orderNum: 21, icon: null, isActive: false }).expect(200);
    expect(changed.body.data).toMatchObject({ orderNum: 21, icon: null, isActive: false });
    expect((await api.get('/dictionaries/categories').expect(200)).body.data)
      .not.toContainEqual(expect.objectContaining({ id: categoryId }));
    expect((await admin('/admin/categories').expect(200)).body.data).toContainEqual(changed.body.data);
    await expect(manageEvent.create(owner, eventData({ categoryId })))
      .rejects.toMatchObject({ statusCode: 422 });
    await expect(manageEvent.update(owner, event.id, { title: 'Updated existing event' }))
      .resolves.toMatchObject({ categoryId });

    const interest = await api.post('/admin/interests').set('X-Test-User', staff.id)
      .send({ name: `Interest ${randomUUID()}` }).expect(201);
    const interestId = interest.body.data.id;
    interestIds.push(interestId);
    expect((await api.get('/dictionaries/interests').expect(200)).body.data)
      .toContainEqual(interest.body.data);
    await api.patch(`/admin/interests/${interestId}`).set('X-Test-User', staff.id)
      .send({ isActive: false }).expect(200);
    expect((await api.get('/dictionaries/interests').expect(200)).body.data)
      .not.toContainEqual(expect.objectContaining({ id: interestId }));
    expect((await admin('/admin/interests').expect(200)).body.data)
      .toContainEqual(expect.objectContaining({ id: interestId, isActive: false }));
    await api.patch(`/admin/interests/${interestId}`).set('X-Test-User', staff.id)
      .send({ isActive: true }).expect(200);
    expect((await api.get('/dictionaries/interests').expect(200)).body.data)
      .toContainEqual(interest.body.data);
  });

  it('counts only registrations, publications and request entries in the half-open period', async () => {
    const [owner, attendee, staff] = await Promise.all([createUser(), createUser(), createUser()]);
    const api = createEventsTestApi([owner, attendee, { ...staff, role: 'ADMIN' }]);
    const from = '2040-08-01T00:00:00.000Z';
    const to = '2040-08-02T00:00:00.000Z';
    const users = dataSource.getRepository(UserEntity);
    await users.update(owner.id, { createdAt: new Date(from) });
    await users.update(attendee.id, { createdAt: new Date(to) });
    const requestEvent = await publishForFeed(owner, { participationMode: 'REQUEST' });
    const freeEvent = await publishForFeed(owner, {});
    const draft = await manageEvent.create(owner, eventData());
    const application = (await manageParticipation.join(attendee, requestEvent.id)).participation;
    const freeEntry = (await manageParticipation.join(attendee, freeEvent.id)).participation;
    expect(application.entryMode).toBe('REQUEST');
    expect(freeEntry.entryMode).toBe('FREE');
    const events = dataSource.getRepository(EventEntity);
    await events.update(requestEvent.id, { participationMode: 'FREE', publishedAt: new Date(from) });
    await events.update(freeEvent.id, { participationMode: 'REQUEST', publishedAt: new Date(to) });
    await events.update(draft.id, { createdAt: new Date(from) });
    await dataSource.getRepository(EventParticipationEntity)
      .update([application.id, freeEntry.id], { createdAt: new Date(from) });
    const path = '/admin/statistics';
    await api.get(path).query({ from, to }).expect(401);
    await api.get(path).query({ from, to }).set('X-Test-User', owner.id).expect(403);
    await api.get(path).query({ from: to, to: from }).set('X-Test-User', staff.id).expect(400);
    const response = await api.get(path).query({ from, to }).set('X-Test-User', staff.id).expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body.data).toEqual({ from, to, users: 1, events: 1, applications: 1 });
  });

  it('moderates reported content and accounts with an audit trail', async () => {
    const [organizer, reporter, staff] = await Promise.all([createUser(), createUser(), createUser()]);
    await dataSource.getRepository(UserEntity).update(staff.id, { role: 'ADMIN' });
    const administrator: AuthUser = { ...staff, role: 'ADMIN' };
    const { api, moderation } = createEventsTestContext([organizer, reporter, administrator]);
    const event = await publishForFeed(organizer, {});
    const submit = (reason: string) => api.post('/reports').set('X-Test-User', reporter.id)
      .send({ objectType: 'EVENT', objectId: event.id, reason });
    await api.get('/admin/reports').set('X-Test-User', reporter.id).expect(403);
    await submit('OTHER').expect(400);
    const attempts = await Promise.all([submit('SPAM'), submit('SPAM')]);
    expect(attempts.map(({ status }) => status).sort()).toEqual([201, 409]);
    const reportId = attempts.find(({ status }) => status === 201)?.body.data.id;
    expect(reportId).toEqual(expect.any(String));

    const reportPath = `/admin/reports/${reportId}`;
    const transition = (status: string) =>
      api.patch(reportPath).set('X-Test-User', administrator.id).send({ status });
    await transition('RESOLVED').expect(409);
    const started = await transition('IN_PROGRESS').expect(200);
    expect(started.body.data).toMatchObject({ assignedModeratorId: administrator.id });
    const queue = await api.get('/admin/reports').set('X-Test-User', administrator.id)
      .query({ status: 'IN_PROGRESS', limit: 1 }).expect(200);
    expect(queue.body.data).toMatchObject([{ id: reportId, status: 'IN_PROGRESS' }]);

    const visibilityPath = `/admin/content/EVENT/${event.id}/visibility`;
    const hide = (isHiddenByAdmin: boolean) =>
      api.patch(visibilityPath).set('X-Test-User', administrator.id)
        .send({ isHiddenByAdmin, reason: 'Report investigation' });
    await hide(true).expect(200);
    await api.get(`/events/${event.id}`).expect(404);
    await submit('SPAM').expect(404);
    const inspected = await api.get(reportPath).set('X-Test-User', administrator.id).expect(200);
    expect(inspected.body.data.target).toMatchObject({
      id: event.id, content: { isHiddenByAdmin: true, title: event.title }
    });
    expect(inspected.body.data.target.content).not.toHaveProperty('onlineUrl');
    await transition('RESOLVED').expect(200);
    await hide(false).expect(200);
    await api.get(`/events/${event.id}`).expect(200);
    await submit('SPAM').expect(201);

    const statusPath = `/admin/users/${organizer.id}/status`;
    const blockedUntil = new Date(Date.now() + 60_000);
    await api.patch(statusPath).set('X-Test-User', administrator.id)
      .send({ status: 'BLOCKED_TEMPORARY', reason: 'Report decision', blockedUntil }).expect(200);
    const users = dataSource.getRepository(UserEntity);
    expect(await users.findOneByOrFail({ id: organizer.id }))
      .toMatchObject({ status: 'BLOCKED_TEMPORARY', blockedUntil });
    await users.update(organizer.id, { blockedUntil: new Date(Date.now() - 1) });
    const stop = moderation.startBlockExpiryWorker();
    await stop();
    expect(await users.findOneByOrFail({ id: organizer.id }))
      .toMatchObject({ status: 'ACTIVE', blockedUntil: null });
    expect(await dataSource.getRepository(NotificationEntity).countBy({
      recipientId: organizer.id, type: 'ACCOUNT_STATUS_CHANGED'
    })).toBe(2);
    const audit = await dataSource.getRepository(AuditLogEntity).findBy({ actorId: administrator.id });
    expect(audit.map(({ action }) => action)).toEqual(expect.arrayContaining([
      'REPORT_STARTED', 'REPORT_TARGET_VIEWED', 'REPORT_RESOLVED',
      'CONTENT_HIDDEN', 'CONTENT_RESTORED', 'USER_BLOCKED'
    ]));
  });

  it('attaches only scoped uploads and makes the first profile photo the primary one', async () => {
    const [owner, other] = await Promise.all([createUser(), createUser()]);
    const images: ImageOwnership = {
      assertOwnedUrl(url, userId, scope) {
        if (!url.startsWith(`https://media.example.com/${userId}/${scope}/`)) {
          throw new AppError('Image does not belong to the current upload scope', 422);
        }
      }
    };
    const { api } = createEventsTestContext([owner, other], undefined, images);
    const putPhotos = (photoUrls: string[]) =>
      api.put('/users/me/photos').set('X-Test-User', owner.id).send({ photoUrls });
    const photoUrls = ['a.webp', 'b.webp', 'c.webp']
      .map((name) => `https://media.example.com/${owner.id}/PROFILE/${name}`);
    const coverUrl = `https://media.example.com/${owner.id}/EVENT/cover.webp`;
    await putPhotos([]).expect(400);
    await putPhotos([...photoUrls, coverUrl]).expect(400);
    await putPhotos([photoUrls[0], photoUrls[0]]).expect(400);
    await putPhotos([coverUrl]).expect(422);
    await putPhotos([`https://media.example.com/${other.id}/PROFILE/other.webp`]).expect(422);
    await putPhotos(photoUrls).expect(200);
    const reversed = [...photoUrls].reverse();
    await putPhotos(reversed).expect(200);
    const profile = await api.get(`/users/${owner.id}`).expect(200);
    expect(profile.body.data).toMatchObject({ avatarUrl: reversed[0], photoUrls: reversed });
    const ownerPhotos = () => api.get('/users/me/photos').set('X-Test-User', owner.id);
    await putPhotos([coverUrl]).expect(422);
    expect((await ownerPhotos().expect(200)).body.data.photoUrls).toEqual(reversed);
    await dataSource.getRepository(UserEntity).update(owner.id, { emailVerified: false });
    await putPhotos([coverUrl]).expect(403);
    expect((await ownerPhotos().expect(200)).body.data.photoUrls).toEqual(reversed);
    await dataSource.getRepository(UserEntity).update(owner.id, { emailVerified: true });

    const draft = await manageEvent.create(owner, eventData({ coverUrl: 'https://legacy.example.com/cover.jpg' }));
    const update = (patch: Record<string, unknown>) =>
      api.patch(`/events/${draft.id}`).set('X-Test-User', owner.id).send(patch);
    await update({ title: 'An updated event' }).expect(200);
    await update({ coverUrl: photoUrls[0] }).expect(422);
    await update({ coverUrl }).expect(200);
  });
});
