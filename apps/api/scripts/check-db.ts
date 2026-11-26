import 'dotenv/config';
import { ok as assert } from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { Client } from 'pg';

const usage = 'Usage: pnpm --filter api check:db [--test]\n' +
  'Reads DATABASE_URL by default. --test uses TEST_DATABASE_URL or the local lokua_test database.';

const requiredColumns = [
  'events.has_approved_participants',
  'event_occurrences.status',
  'event_location_snapshot.public_coordinates',
  'event_participations.status_updated_at',
  'discussion_comment_quotas.posted_at',
  'reports.assigned_moderator_id',
  'audit_logs.actor_id',
  'notifications.email_due_at',
  'notifications.deduplication_key',
  'users.email_notifications_enabled',
  'users.blocked_until'
] as const;

const requiredIndexes = [
  'idx_participations_unique_pair',
  'idx_event_reviews_unique_pair',
  'idx_event_occurrence_unique_slot',
  'idx_notifications_deduplication',
  'idx_notifications_email_due'
] as const;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log(usage); return; }
  assert(args.length === 0 || (args.length === 1 && args[0] === '--test'), usage);
  const test = args[0] === '--test';
  console.log(`🚀 Checking ${test ? 'test' : 'configured'} PostgreSQL database...`);
  const url = test
    ? (process.env.TEST_DATABASE_URL ?? 'postgres://lokua:lokua@localhost:5433/lokua_test')
    : process.env.DATABASE_URL;
  assert(url, 'DATABASE_URL is required');
  const files = await readdir(new URL('../src/db/migrations/', import.meta.url));
  const expectedMigrations = files.flatMap((file) => {
    const match = file.match(/^(\d{13})-([\w-]+)\.ts$/);
    if (!match) return [];
    return [`${match[2]}${match[1]}`];
  });
  assert(expectedMigrations.length > 0, 'No local migration files found');

  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    statement_timeout: 8000,
    ...(process.env.NODE_ENV === 'production' && !test
      ? { ssl: { rejectUnauthorized: true } }
      : {})
  });
  try {
    await client.connect();
  } catch (error) {
    return failDatabase('PostgreSQL connection', error);
  }
  try {
    await client.query('BEGIN READ ONLY');
    const extensions = await client.query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'uuid-ossp')"
    );
    const installed = new Set(extensions.rows.map(({ extname }) => extname));
    const missingExtensions = ['postgis', 'uuid-ossp'].filter((name) => !installed.has(name));
    const catalog = await client.query<{ name: string | null }>("SELECT to_regclass('migrations')::text AS name");
    const applied = catalog.rows[0]?.name
      ? await client.query<{ name: string }>('SELECT name FROM migrations')
      : { rows: [] };
    const appliedNames = new Set(applied.rows.map(({ name }) => name));
    const pending = expectedMigrations.filter((name) => !appliedNames.has(name));
    const unknown = [...appliedNames].filter((name) => !expectedMigrations.includes(name));
    const columnRows = await client.query<{ name: string }>(
      `SELECT table_name || '.' || column_name AS name
       FROM information_schema.columns WHERE table_schema = current_schema()`
    );
    const columns = new Set(columnRows.rows.map(({ name }) => name));
    const missingColumns = requiredColumns.filter((name) => !columns.has(name));
    const indexRows = await client.query<{ indexname: string }>(
      'SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()'
    );
    const indexes = new Set(indexRows.rows.map(({ indexname }) => indexname));
    const missingIndexes = requiredIndexes.filter((name) => !indexes.has(name));
    const problems = [
      ...missingExtensions.map((name) => `Missing extension: ${name}`),
      ...pending.map((name) => `Pending migration: ${name}`),
      ...unknown.map((name) => `Applied migration not present on this branch: ${name}`),
      ...missingColumns.map((name) => `Missing column: ${name}`),
      ...missingIndexes.map((name) => `Missing index: ${name}`)
    ];
    if (problems.length) {
      for (const problem of problems) console.error(`❌ FAIL: ${problem}`);
      process.exitCode = 1;
    } else {
      console.log(`✅ PASS: PostgreSQL readiness (${appliedNames.size} migrations, ${installed.size} extensions)`);
    }
  } catch (error) {
    failDatabase('PostgreSQL readiness query', error);
  } finally {
    await client.end();
  }
}

function failDatabase(operation: string, error: unknown) {
  const code = error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'unknown';
  console.error(`❌ FAIL: ${operation} (${code})`);
  process.exitCode = 1;
}

try {
  await main();
} catch {
  console.error(`❌ FAIL: Could not start database check.\n${usage}`);
  process.exitCode = 1;
}
