import 'dotenv/config';
import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Client } from 'pg';
import sharp from 'sharp';
import { z } from 'zod';
import { smokeEvents } from './smoke-events.js';

const uuid = z.uuid();
const idData = z.object({ data: z.object({ id: uuid }) });
const catalog = z.object({ data: z.array(z.object({ id: uuid })) });
const notificationList = z.object({
  data: z.array(z.object({ targetId: uuid, type: z.string() }))
});
const storage = {
  endpoint: 'http://127.0.0.1:9000',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId: 'lokua', secretAccessKey: 'lokua_secret' }
};
const testBucket = 'lokua-uploads-test';

async function checkTestStorage() {
  const client = new S3Client(storage);
  try {
    await client.send(new HeadBucketCommand({ Bucket: testBucket }), {
      abortSignal: AbortSignal.timeout(5000)
    });
  } catch {
    throw new Error('The local test bucket is unavailable. Run docker compose up -d minio minio-init.');
  } finally {
    client.destroy();
  }
}

async function checkTestApiPort(port: number) {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(2000, () => {
      socket.destroy();
      reject(new Error(`Could not check test API port ${port}`));
    });
    socket.once('connect', () => {
      socket.destroy();
      reject(new Error(`Port ${port} is already in use. Set SMOKE_LIFECYCLE_PORT to a free port.`));
    });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNREFUSED') resolve();
      else reject(error);
    });
  });
}

function launchTestApi(databaseUrl: string, origin: string): ChildProcess {
  const { port, hostname } = new URL(origin);
  return fork(fileURLToPath(new URL('../src/server.ts', import.meta.url)), [], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    execArgv: ['--import', 'tsx'],
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: port,
      BIND_HOST: hostname,
      TRUST_PROXY_HOPS: '0',
      APP_URL: origin,
      CLIENT_URL: origin,
      DATABASE_URL: databaseUrl,
      DATABASE_URL_DIRECT: databaseUrl,
      LOCAL_SMTP_PORT: '1025',
      BREVO_SMTP_USER: 'local-smoke',
      BREVO_SMTP_KEY: 'local-smoke',
      BREVO_SENDER_EMAIL: 'smoke@example.test',
      STORAGE_ENDPOINT: storage.endpoint,
      STORAGE_REGION: storage.region,
      STORAGE_FORCE_PATH_STYLE: 'true',
      STORAGE_BUCKET: testBucket,
      STORAGE_ACCESS_KEY_ID: storage.credentials.accessKeyId,
      STORAGE_SECRET_ACCESS_KEY: storage.credentials.secretAccessKey,
      JWT_ACCESS_SECRET: randomUUID(),
      JWT_REFRESH_SECRET: randomUUID(),
      STORAGE_IMAGE_SIGNING_SECRET: randomUUID(),
      GOOGLE_CLIENT_ID: 'local-smoke',
      GOOGLE_CLIENT_SECRET: 'local-smoke',
      GOOGLE_REDIRECT_URI: `${origin}/api/v1/auth/google/callback`,
      GOOGLE_SUCCESS_REDIRECT: origin,
      WEBAUTHN_RP_ID: hostname,
      WEBAUTHN_ORIGIN: origin,
      WEBAUTHN_RP_NAME: 'LOKUA smoke'
    }
  });
}

async function waitForTestApi(child: ChildProcess, origin: string) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Test API startup timed out at ${origin}`)), 25_000);
    function ready(message: unknown) {
      if (z.object({ type: z.literal('ready') }).safeParse(message).success) {
        cleanup();
        resolve();
      }
    }
    function exited() {
      cleanup();
      reject(new Error(`Test API exited before it could listen at ${origin}. Check the startup log.`));
    }
    function cleanup() {
      clearTimeout(timer);
      child.off('message', ready).off('exit', exited).off('error', exited);
    }
    child.on('message', ready).once('exit', exited).once('error', exited);
  });
}

async function stopTestApi(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit', { signal: AbortSignal.timeout(12_000) });
  if (child.connected) child.disconnect();
  try {
    await exited;
  } catch {
    child.kill();
  }
}

function localUrl(raw: string, protocols: string[]) {
  const url = new URL(raw);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Use a loopback test endpoint');
  assert(protocols.includes(url.protocol), 'Unexpected test endpoint protocol');
  return url;
}

class SmokeSession {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly origin: string) {}

  async call(path: string, expected: number, method = 'GET', body?: object | Uint8Array<ArrayBuffer>) {
    const bytes = body instanceof Uint8Array;
    const response = await fetch(`${this.origin}/api/v1${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: {
        ...(body ? { 'Content-Type': bytes ? 'image/png' : 'application/json' } : {}),
        Cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ')
      },
      body: bytes ? body : body ? JSON.stringify(body) : undefined
    }).catch(() => {
      throw new Error(`API request failed at ${this.origin} (${method} ${path.split('?')[0]})`);
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';', 1);
      const separator = pair.indexOf('=');
      if (separator > 0) this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    assert.equal(response.status, expected, `${method} ${path.split('?')[0]} returned ${response.status}`);
    return response;
  }

  async json(path: string, expected: number, method?: string, body?: object | Uint8Array<ArrayBuffer>): Promise<unknown> {
    return (await this.call(path, expected, method, body)).json();
  }
}

async function waitFor<T>(label: string, timeoutMs: number, attempt: () => Promise<T | undefined>) {
  const end = Date.now() + timeoutMs;
  do {
    const result = await attempt();
    if (result !== undefined) return result;
    await delay(1000);
  } while (Date.now() < end);
  throw new Error(`Timed out waiting for ${label}`);
}

async function mailJson(url: URL): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' })
    .catch(() => { throw new Error(`Mailpit request failed at ${url.origin}`); });
  assert(response.ok, `Mailpit ${url.pathname} returned ${response.status}`);
  return response.json();
}

async function verificationToken(mailpit: URL, email: string) {
  const search = new URL('/api/v1/search', mailpit);
  search.searchParams.set('query', `to:${email}`);
  return waitFor('verification email', 20_000, async () => {
    const { messages } = z.object({ messages: z.array(z.object({ ID: z.string() })).nullable() })
      .parse(await mailJson(search));
    const [message] = messages ?? [];
    if (!message) return;
    const url = new URL(`/api/v1/message/${encodeURIComponent(message.ID)}`, mailpit);
    const mail = z.object({ HTML: z.string() }).parse(await mailJson(url));
    return /\/api\/v1\/auth\/verify-email\?token=([a-f0-9]{64})\b/i.exec(mail.HTML)?.[1];
  });
}

async function register(
  session: SmokeSession,
  mailpit: URL,
  database: Client,
  cityId: string,
  interestIds: string[],
  image: Uint8Array<ArrayBuffer>
) {
  const email = `lifecycle-${randomUUID()}@example.test`;
  const name = 'Smoke test';
  const { user } = z.object({ user: z.object({ id: uuid }) }).parse(
    await session.json('/auth/register', 201, 'POST', {
      email, name, password: randomUUID(), termsAccepted: true
    })
  );
  const registration = await database.query('SELECT 1 FROM users WHERE id = $1 AND email = $2', [
    user.id, email
  ]);
  assert.equal(
    registration.rowCount,
    1,
    'The test API registration is missing from lokua_test'
  );
  const token = await verificationToken(mailpit, email);
  await session.call(`/auth/verify-email?token=${token}`, 200);
  const upload = z.object({ data: z.object({ url: z.url() }) }).parse(
    await session.json('/media/images?scope=PROFILE', 201, 'POST', image)
  );
  await session.call('/onboarding/date-of-birth', 200, 'POST', { birthDate: '1995-06-15' });
  await session.call('/onboarding/profile', 200, 'POST', { name, mainPhotoUrl: upload.data.url });
  await session.call('/onboarding/city', 200, 'POST', { cityId });
  await session.call('/onboarding/interests', 200, 'POST', { interestIds });
  await session.call('/onboarding/complete', 200, 'POST');
  return user.id;
}

async function makeEventDue(db: Client, eventId: string, organizerId: string, startsAt: Date) {
  await db.query('BEGIN');
  try {
    const result = await db.query(
      `UPDATE events
       SET first_starts_at = now() - interval '2 minutes', first_ends_at = now() - interval '1 minute'
       WHERE id = $1 AND organizer_id = $2 AND first_starts_at = $3
         AND status IN ('PUBLISHED', 'FULL')
       RETURNING first_starts_at, first_ends_at`,
      [eventId, organizerId, startsAt]
    );
    assert.equal(result.rowCount, 1, 'Smoke event schedule changed unexpectedly');
    const { first_starts_at, first_ends_at } = result.rows[0];
    const occurrence = await db.query(
      `UPDATE event_occurrences SET starts_at = $2, ends_at = $3
       WHERE event_id = $1 AND starts_at = $4`,
      [eventId, first_starts_at, first_ends_at, startsAt]
    );
    assert.equal(occurrence.rowCount, 1, 'Smoke event occurrence not found');
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const eventsOnly = args.includes('--events');
  const onboardingOnly = args.includes('--onboarding');
  if (process.argv.includes('--help')) {
    console.log('Usage: pnpm --filter api smoke:lifecycle | smoke:onboarding | smoke:events');
    console.log('Starts its own local API on port 3004. Start db-test, Mailpit and MinIO first.');
    console.log('Use SMOKE_LIFECYCLE_PORT if 3004 is occupied. Database defaults to localhost:5433/lokua_test.');
    console.log('Override the connection with SMOKE_LIFECYCLE_DATABASE_URL or TEST_DATABASE_URL.');
    return;
  }
  assert(args.length === 0 || (args.length === 1 && (eventsOnly || onboardingOnly)), 'Unknown smoke option');
  const port = z.coerce.number().int().min(1).max(65535)
    .parse(process.env.SMOKE_LIFECYCLE_PORT ?? 3004);
  const origin = `http://127.0.0.1:${port}`;
  const mailpit = localUrl(process.env.SMOKE_MAILPIT_URL ?? 'http://127.0.0.1:8025', ['http:', 'https:']);
  const connectionString =
    process.env.SMOKE_LIFECYCLE_DATABASE_URL ??
    process.env.TEST_DATABASE_URL ??
    'postgres://lokua:lokua@localhost:5433/lokua_test';
  const dbUrl = localUrl(connectionString, ['postgres:', 'postgresql:']);
  assert(dbUrl.pathname === '/lokua_test', 'Use the dedicated lokua_test database');

  const organizer = new SmokeSession(origin);
  const participant = new SmokeSession(origin);
  const guest = new SmokeSession(origin);
  const db = new Client({ connectionString: dbUrl.href, connectionTimeoutMillis: 5000 });
  let child: ChildProcess | undefined;
  await db.connect();
  try {
    const target = await db.query<{ name: string }>('SELECT current_database() AS name');
    assert.equal(target.rows[0]?.name, 'lokua_test', 'Use the dedicated lokua_test database');
    const schema = await db.query<{ migrated: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'event_participations'
          AND column_name = 'entry_mode'
      ) AS migrated`
    );
    assert(schema.rows[0]?.migrated, 'Apply TrackParticipationEntryMode to lokua_test before running this smoke');
    if (!eventsOnly) {
      await mailJson(new URL('/api/v1/info', mailpit));
      await checkTestStorage();
    }
    await checkTestApiPort(port);
    child = launchTestApi(dbUrl.href, origin);
    await waitForTestApi(child, origin);
    if (eventsOnly) {
      await smokeEvents(new URL(origin));
      return;
    }
    const city = await db.query<{ id: string }>(
      "SELECT id FROM cities WHERE slug = 'kyiv' AND country_code = 'UA' AND is_active"
    );
    assert(city.rows[0], 'Kyiv must be available in the test database');
    const categories = catalog.parse(await guest.json('/dictionaries/categories', 200)).data;
    const interests = catalog.parse(await guest.json('/dictionaries/interests', 200)).data;
    assert(categories.length > 0 && interests.length >= 3, 'Seed the test dictionaries');
    const image = new Uint8Array(await sharp({
      create: { width: 24, height: 24, channels: 3, background: '#8473a0' }
    }).png().toBuffer());
    const options = [mailpit, db, city.rows[0].id, interests.slice(0, 3).map(({ id }) => id), image] as const;
    const organizerId = await register(organizer, ...options);
    if (onboardingOnly) {
      const profile = z.object({
        user: z.object({ id: uuid, onboardingCompleted: z.literal(true), avatarUrl: z.url() })
      }).parse(await organizer.json('/auth/me', 200));
      assert.equal(profile.user.id, organizerId);
      await organizer.call('/auth/logout', 200, 'POST');
      await organizer.call('/auth/me', 401);
      console.log('PASS: registration, email verification, profile photo, onboarding and logout');
      return;
    }
    const participantId = await register(participant, ...options);
    console.log(`Registered and onboarded smoke users ${organizerId} and ${participantId}`);

    const startsAt = new Date(Date.now() + 2 * 3_600_000);
    const onlineUrl = 'https://example.test/smoke-meeting';
    const { data: { id } } = idData.parse(await organizer.json('/events', 201, 'POST', {
      title: 'Lokua lifecycle smoke', description: 'Local smoke fixture',
      categoryId: categories[0].id, format: 'ONLINE', onlineUrl,
      participationMode: 'REQUEST', ageRestriction: 'ALL', capacityLimit: 2, isFree: true,
      firstStartsAt: startsAt, firstEndsAt: new Date(startsAt.getTime() + 3_600_000)
    }));
    const event = `/events/${id}`;
    console.log(`Created smoke event ${id}`);
    await organizer.call(`${event}/publish`, 200, 'POST');
    const card = z.object({
      data: z.object({ status: z.string(), onlineUrl: z.string().nullable() })
    });
    assert.equal(card.parse(await guest.json(event, 200)).data.onlineUrl, null);
    const join = z.object({
      data: z.object({ participation: z.object({ id: uuid, status: z.literal('PENDING') }) })
    }).parse(await participant.json(`${event}/participations`, 200, 'POST', { message: 'Smoke request' }));
    await organizer.call(`${event}/applications/${join.data.participation.id}/approve`, 200, 'POST');
    assert.equal(card.parse(await participant.json(event, 200)).data.onlineUrl, onlineUrl);
    const inbox = async () => notificationList.parse(await participant.json('/notifications', 200)).data;
    assert((await inbox()).some((item) => item.type === 'APPLICATION_APPROVED' && item.targetId === id));

    await makeEventDue(db, id, organizerId, startsAt);
    await waitFor('the lifecycle worker to complete the event', 85_000, async () => {
      if (card.parse(await participant.json(event, 200)).data.status === 'COMPLETED') return true;
    });
    assert((await inbox()).some((item) => item.type === 'REVIEW_REMINDER' && item.targetId === id));
    const review = idData.parse(await participant.json(`${event}/reviews`, 201, 'POST', {
      rating: 5, text: 'Smoke review'
    }));
    const reviews = z.object({ data: z.array(z.object({ id: uuid, rating: z.number() })) });
    assert(reviews.parse(await guest.json(`${event}/reviews`, 200)).data
      .some((item) => item.id === review.data.id && item.rating === 5));
    await organizer.call('/auth/logout', 200, 'POST');
    await participant.call('/auth/logout', 200, 'POST');
    console.log('PASS: registration, onboarding, publication, approval, completion and public review');
  } finally {
    await Promise.all([db.end(), child ? stopTestApi(child) : undefined]);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Lifecycle smoke failed');
  process.exitCode = 1;
});
