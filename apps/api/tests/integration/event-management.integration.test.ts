import { randomUUID } from 'node:crypto';
import express from 'express';
import type { RequestHandler } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeOrmUnitOfWork } from '../../src/common/index.js';
import { errorHandler } from '../../src/middlewares/index.js';
import { createDictionariesModule } from '../../src/modules/dictionaries/index.js';
import { createGeolocationModule, obfuscateCoordinates } from '../../src/modules/geolocation/index.js';
import type { LocationProvider } from '../../src/modules/geolocation/index.js';
import { AccessService, createUsersModule } from '../../src/modules/users/index.js';
import type { AuthUser } from '../../src/modules/users/index.js';
import { UserBlockEntity, UserEntity, UserRepositoryAdapter } from '../../src/modules/users/infrastructure/index.js';
import { GetEventsUseCase } from '../../src/modules/events/application/index.js';
import { createEventsModule } from '../../src/modules/events/index.js';
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
        await dataSource.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
      }
      if (locationIds.length) {
        await dataSource.query('DELETE FROM locations WHERE id = ANY($1::uuid[])', [locationIds]);
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
    const { categories, cities, countries } = createDictionariesModule({ dataSource });
    const users = createUsersModule({ dataSource });
    const geo = createGeolocationModule({
      dataSource,
      cities,
      countries,
      users: users.users,
      requireAuth
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
      requireAuth
    });
    const app = express();
    app.use(express.json());
    app.use('/events', events.router);
    app.use('/users', events.profilesRouter);
    app.use('/geo', geo.router);
    app.use(errorHandler);
    return request(app);
  }

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
    for (const [blockerId, blockedId] of [
      [owner.id, participant.id],
      [participant.id, owner.id]
    ]) {
      await blocks.insert({ blockerId, blockedId });
      await get(onlineDraft.id, participant).expect(404);
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
      coordinates: obfuscateCoordinates(exactCoordinates),
      address: null,
      name: null,
      isExact: false
    });
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
    await publishForFeed(blockedByViewer, base);
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
    const items = [...firstPage.items, ...secondPage.items];
    expect(items.map((event) => event.id)).toEqual([open.id, full.id].sort());
    expect(secondPage.nextCursor).toBeNull();
    expect(items.find((event) => event.id === full.id)?.hasAvailablePlaces).toBe(false);
    expect(toFeedEventView(items[0])).not.toHaveProperty('onlineUrl');

    const onlyAvailable = await getEvents.execute({ ...query, availableOnly: true }, viewer);
    expect(onlyAvailable.items.map((event) => event.id)).toEqual([open.id]);
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
    const origin = obfuscateCoordinates(exactCoordinates);
    const location = await locations.create({
      name: 'Hidden map venue',
      address: 'Private venue address',
      cityId: kyivId,
      districtId: null,
      countryCode: 'UA',
      exactCoordinates,
      publicCoordinates: origin,
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
    expect(markers[0]).toMatchObject({ coordinates: origin });
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
    await blocks.insert({ blockerId: viewer.id, blockedId: owner.id });
    await expect(manageParticipation.join(viewer, restricted.id))
      .rejects.toMatchObject({ statusCode: 404 });
    await blocks.delete({ blockerId: viewer.id, blockedId: owner.id });

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
    await blocks.insert({ blockerId: applicant.id, blockedId: owner.id });
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
    await blocks.delete({ blockerId: applicant.id, blockedId: owner.id });
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
    await post(outsider, 'This should be forbidden').expect(403);
    await post(owner, '  ').expect(400);
    const root = (await post(owner, '  First comment  ').expect(201)).body.data;
    expect(root).toMatchObject({ text: 'First comment', parentId: null, author: { id: owner.id } });
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
    expect(archivedThread.body.data).toMatchObject([
      { id: reply.id, isArchived: true, text: 'Updated reply' }
    ]);
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
    expect(card.body.data.reviews.data.map(({ id }: { id: string }) => id).sort())
      .toEqual([firstReview.id, secondReview.id].sort());

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
  });
});
