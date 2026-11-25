import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeOrmUnitOfWork } from '../../src/common/index.js';
import { createDictionariesModule } from '../../src/modules/dictionaries/index.js';
import type { LocationProvider } from '../../src/modules/geolocation/index.js';
import { AccessService } from '../../src/modules/users/index.js';
import type { AuthUser } from '../../src/modules/users/index.js';
import { UserEntity, UserRepositoryAdapter } from '../../src/modules/users/infrastructure/index.js';
import { ManageEventUseCase } from '../../src/modules/events/application/use-cases/manage-event.use-case.js';
import type { CreateEventData } from '../../src/modules/events/application/index.js';
import { EventEntity, EventRepositoryAdapter } from '../../src/modules/events/infrastructure/index.js';
import { EventOccurrenceEntity } from '../../src/modules/events/infrastructure/persistence/entities/event-occurrence.entity.js';
import { EventParticipationEntity } from '../../src/modules/events/infrastructure/persistence/entities/event-participation.entity.js';
import { createTestDataSource } from './helpers/test-db.js';

describe('event management with PostgreSQL', () => {
  const dataSource = createTestDataSource();
  const now = new Date('2026-11-25T12:00:00Z');
  const locations: LocationProvider = {
    findById: async () => null,
    findPublicById: async () => null,
    create: async () => { throw new Error('Unexpected location creation'); }
  };

  let manageEvent: ManageEventUseCase;
  let categoryId: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    await dataSource.initialize();
    const { categories } = createDictionariesModule({ dataSource });
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
});

