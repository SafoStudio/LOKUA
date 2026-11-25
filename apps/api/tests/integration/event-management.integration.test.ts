import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeOrmUnitOfWork } from '../../src/common/index.js';
import { createDictionariesModule } from '../../src/modules/dictionaries/index.js';
import { createGeolocationModule, obfuscateCoordinates } from '../../src/modules/geolocation/index.js';
import type { LocationProvider } from '../../src/modules/geolocation/index.js';
import { AccessService, createUsersModule } from '../../src/modules/users/index.js';
import type { AuthUser } from '../../src/modules/users/index.js';
import { UserBlockEntity, UserEntity, UserRepositoryAdapter } from '../../src/modules/users/infrastructure/index.js';
import { GetEventsUseCase } from '../../src/modules/events/application/index.js';
import { toFeedEventView, toMapEventView } from '../../src/modules/events/presentation/http/event.view.js';
import { ManageParticipationUseCase } from '../../src/modules/events/application/use-cases/manage-participation.use-case.js';
import { ManageEventUseCase } from '../../src/modules/events/application/use-cases/manage-event.use-case.js';
import type { CreateEventData } from '../../src/modules/events/application/index.js';
import { EventEntity, EventRepositoryAdapter } from '../../src/modules/events/infrastructure/index.js';
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

  let manageParticipation: ManageParticipationUseCase;
  let manageEvent: ManageEventUseCase;
  let categoryId: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    await dataSource.initialize();
    const { categories, cities, countries } = createDictionariesModule({ dataSource });
    const users = createUsersModule({ dataSource });
    manageParticipation = new ManageParticipationUseCase(
      new EventRepositoryAdapter(dataSource.getRepository(EventEntity)),
      new TypeOrmUnitOfWork(dataSource),
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
    await expect(manageEvent.delete(owner, draft.id)).rejects.toThrow('participant history');
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

    const tag = randomUUID();
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
    const tag = randomUUID();
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
    const tag = randomUUID();
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
    await expect(manageParticipation.join(viewer, request.id))
      .rejects.toMatchObject({ statusCode: 409 });

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
});
