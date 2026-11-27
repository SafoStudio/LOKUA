import { ok as assert, strictEqual } from 'node:assert/strict';
import { z } from 'zod';

const eventSchema = z.object({ id: z.uuid(), status: z.enum(['PUBLISHED', 'FULL']) }).passthrough();
const pageSchema = z.object({
  data: z.array(eventSchema),
  pagination: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() })
});
const detailSchema = z.object({
  id: z.uuid(),
  hideExactAddress: z.boolean(),
  onlineUrl: z.null(),
  participantAvatars: z.array(z.unknown()).length(0),
  participationStatus: z.null(),
  organizer: z.object({ id: z.uuid(), rating: z.number().nullable() }).passthrough(),
  location: z.object({ isExact: z.boolean() }).passthrough().nullable()
}).passthrough();
const mapSchema = z.object({
  data: z.array(eventSchema.extend({
    hasAvailablePlaces: z.boolean(),
    coordinates: z.object({
      latitude: z.number().min(50.3).max(50.6),
      longitude: z.number().min(30.3).max(30.8)
    })
  })),
  pagination: pageSchema.shape.pagination
});

function assertNoPrivateFields(value: Record<string, unknown>) {
  for (const name of ['primaryLocationId', 'email', 'createdBy']) {
    assert(!Object.hasOwn(value, name), `Unexpected field: ${name}`);
  }
}

export async function smokeEvents(baseUrl: URL) {
  assert(['http:', 'https:'].includes(baseUrl.protocol), 'Expected an HTTP(S) API URL');
  assert(!baseUrl.username && !baseUrl.password, 'Credentials are not accepted in the API URL');
  const selectedId = process.env.SMOKE_EVENT_ID ? z.uuid().parse(process.env.SMOKE_EVENT_ID) : null;
  console.log('🚀 Starting events smoke test...');

  async function get(path: string, expected: number) {
    let response: Response;
    try {
      response = await fetch(new URL(path, baseUrl), {
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
        headers: { Accept: 'application/json' }
      });
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      const code = cause instanceof Error && 'code' in cause ? String(cause.code) : null;
      throw new Error(`GET ${path} failed at ${baseUrl.origin}${code ? ` (${code})` : ''}`);
    }
    strictEqual(response.status, expected, `GET ${path} returned HTTP ${response.status}`);
    if (expected !== 200) {
      await response.body?.cancel();
      return null;
    }
    return await response.json() as unknown;
  }

  const health = z.object({ status: z.literal('ok') }).parse(await get('/health', 200));
  strictEqual(health.status, 'ok');
  const spec = z.object({ paths: z.record(z.string(), z.record(z.string(), z.unknown())) })
    .parse(await get('/docs/openapi.json', 200));
  for (const [path, method] of [
    ['/api/v1/events', 'get'], ['/api/v1/events/me', 'get'], ['/api/v1/events/{id}', 'get'],
    ['/api/v1/notifications', 'get'], ['/api/v1/reports', 'post'], ['/api/v1/media/images', 'post']
  ] as const) {
    assert(spec.paths[path]?.[method], `Missing documented operation: ${method.toUpperCase()} ${path}`);
  }
  console.log('✅ PASS: Health and published OpenAPI');

  for (const path of ['/events/me?tab=GOING', '/notifications', '/users/me/photos', '/admin/reports']) {
    await get(`/api/v1${path}`, 401);
  }
  console.log('✅ PASS: Protected endpoints reject anonymous requests');

  for (const path of [
    '/events?limit=0',
    '/events?sort=DISTANCE',
    '/events/not-a-uuid',
    '/events/map?minLat=50.6&maxLat=50.3&minLng=30.3&maxLng=30.8'
  ]) {
    await get(`/api/v1${path}`, 400);
  }
  console.log('✅ PASS: Invalid feed, map and event parameters return 400');

  const page = pageSchema.parse(await get('/api/v1/events?limit=5', 200));
  assert(page.data.length <= 5, 'Feed exceeded the page size');
  strictEqual(page.pagination.hasMore, page.pagination.nextCursor !== null);
  for (const event of page.data) {
    assertNoPrivateFields(event);
    assert(!Object.hasOwn(event, 'onlineUrl'), 'Feed exposed an online URL');
  }
  strictEqual(new Set(page.data.map(({ id }) => id)).size, page.data.length, 'Feed returned duplicate events');
  console.log(`✅ PASS: Public feed contract (${page.data.length} items)`);

  const map = mapSchema.parse(await get(
    '/api/v1/events/map?minLat=50.3&maxLat=50.6&minLng=30.3&maxLng=30.8&limit=5',
    200
  ));
  assert(map.data.length <= 5, 'Map exceeded the page size');
  strictEqual(map.pagination.hasMore, map.pagination.nextCursor !== null);
  for (const marker of map.data) {
    assertNoPrivateFields(marker);
    assert(!Object.hasOwn(marker, 'onlineUrl'), 'Map exposed an online URL');
  }
  console.log(`✅ PASS: Map markers respect the viewport and privacy (${map.data.length} markers)`);

  const id = selectedId ?? page.data[0]?.id;
  if (!id) {
    console.log('⚠️ SKIP: Public event detail (no feed results; set SMOKE_EVENT_ID to check a fixture)');
    console.log('🎉 Events smoke checks completed.');
    return;
  }
  const detail = z.object({ data: detailSchema }).parse(await get(`/api/v1/events/${id}`, 200)).data;
  strictEqual(detail.id, id);
  assertNoPrivateFields(detail);
  assertNoPrivateFields(detail.organizer);
  if (detail.hideExactAddress && detail.location) {
    strictEqual(detail.location.isExact, false);
    assert(detail.location.address == null, 'Guest received the hidden address');
  }
  console.log('✅ PASS: Public event detail and guest privacy');
  console.log('🎉 Events smoke checks completed.');
}
