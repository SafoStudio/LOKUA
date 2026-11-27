# LOKUA API

Backend for event management

## Stack

- **Runtime:** Node.js 24, TypeScript 5.9, ESM (`"type": "module"`)
- **HTTP:** Express 5
- **Database:** PostgreSQL 16, TypeORM (migrations, `synchronize` disabled)
- **Validation:** Zod 4
- **Authentication:** JWT (`jose`), bcrypt, Google OAuth, WebAuthn (passkeys)
- **Email:** nodemailer + Brevo SMTP
- **Storage:** S3-compatible (`@aws-sdk/client-s3`) — MinIO locally, Cloudflare R2 in production
- **Logging:** pino + pino-http
- **Testing:** Vitest 5 + Supertest
- **Package manager:** pnpm

## Architecture

Pragmatic Clean Architecture + Modular Monolith.

```
apps/api/src/
├── app.ts # Express app (middleware, routes, error handler)
├── server.ts # bootstrap: DataSource → modules → listen → graceful shutdown
├── bootstrap/ # composition root (modules.ts)
├── common/ # AppError, logger, assert helpers
├── config/ # env (Zod validation)
├── db/ # data-source + migrations
├── docs/ # OpenAPI (builder, loader, router)
├── middlewares/ # error, not-found, validate
├── modules/
│ ├── auth/ # authentication and sessions
│ ├── dictionaries/ # countries, cities, interests, categories
│ ├── events/ # event drafts and discovery
│ ├── geolocation/ # locations and geocoding
│ ├── moderation/ # administrative actions and audit
│ ├── notifications/ # notification persistence
│ ├── onboarding/ # profile setup
│ ├── storage/ # S3 adapter (MinIO / R2)
│ └── users/ # accounts, profiles and access policies
└── types/ # express.d.ts
```

Modules use `domain / application / infrastructure / presentation` layers as needed. See [AGENTS.md](./AGENTS.md) for implementation conventions. The composition root is `bootstrap/modules.ts`. Barrel files (`index.ts`) use explicit named exports only (`export *` is forbidden). Cross-module imports go through the module's public `index.ts`.

## Requirements

- Node.js 24+
- pnpm 9+
- Docker + Docker Compose

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp apps/api/.env.example apps/api/.env
```

Required variables:

Variable Description

#### NODE_ENV _development / production / test_

#### PORT _API port (default 3003)_

#### APP_URL _Public API URL_

#### CLIENT_URL _Client URL (CORS + redirects)_

#### DATABASE_URL _PostgreSQL connection string (runtime)_

#### DATABASE_URL_DIRECT _Direct URL for migrations in production (Neon). Optional locally_

#### JWT_ACCESS_SECRET / JWT_REFRESH_SECRET _Secrets (≥ 32 chars)_

#### JWT_ACCESS_TTL / JWT_REFRESH_TTL _Token TTLs (15m / 7d)_

#### GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI / GOOGLE_SUCCESS_REDIRECT _Google OAuth_

#### WEBAUTHN_RP_ID / WEBAUTHN_RP_NAME / WEBAUTHN_ORIGIN _WebAuthn (passkeys)_

#### BREVO_SMTP_USER / BREVO_SMTP_KEY / BREVO_SENDER_EMAIL _Email_

#### STORAGE_ENDPOINT / STORAGE_REGION / STORAGE_BUCKET _S3 (MinIO/R2)_

#### STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY _S3 credentials_

The account deletion worker lists and deletes objects under `images/<userId>/`. The storage
credentials need bucket listing and object deletion access for that prefix. Configure lifecycle
rules for retained object versions if the bucket uses versioning.

Account recovery emails link to `CLIENT_URL/account/restore#token=...`. That client page reads the
fragment and posts the token to `/api/v1/auth/account/restore`. After a successful response, the
user signs in again.

Email change links open `CLIENT_URL/account/confirm-email#token=...`. The client sends the
fragment token to `POST /api/v1/auth/change-email/confirm` with the current user's session.
For account creation, send `termsAccepted: true` with password registration and passkey signup
verification. For Google signup, start OAuth with `?termsAccepted=true` after consent.

#### STORAGE_FORCE_PATH_STYLE _true for MinIO, false for R2_

#### STORAGE_SIGNED_URL_TTL _Signed URL TTL (default 900 s)_

#### STORAGE_MAX_UPLOAD_BYTES _Max upload size (default 10 MiB)_

_Env is validated by Zod at startup — the process exits with an error log on invalid values._

## Local development

1. Infrastructure

```
docker compose up -d
```

Starts:

- Service Container Port Purpose
- PostgreSQL (dev) lokua-db 5432 Main database lokua
- PostgreSQL (test) lokua-db-test 5433 Test database lokua_test (tmpfs, reset on restart)
- pgAdmin lokua-pgadmin 5050 Web DB client (admin@gmail.com / admin)
- MinIO lokua-minio 9000 (S3 API), 9001 (Console) S3 storage (lokua / lokua_secret)
- MinIO init lokua-minio-init — Creates bucket lokua-uploads and exits

Check:

bash
docker compose ps 2. Dependencies

```
pnpm install
```

3. Migrations
   ```
   pnpm --filter api m:run
   ```
4. Dev server

   ```
   pnpm --filter api dev
   ```

   API: http://localhost:3003

   Health: http://localhost:3003/health

   Scalar UI: http://localhost:3003/docs

5. MinIO Console
   http://localhost:9001 — user lokua, password lokua_secret. Bucket lokua-uploads is created automatically by the minio-init service.

Important: .env must contain

- STORAGE_BUCKET=lokua-uploads,
- STORAGE_ENDPOINT=http://localhost:9000,
- STORAGE_REGION=us-east-1,
- STORAGE_FORCE_PATH_STYLE=true,
- STORAGE_ACCESS_KEY_ID=lokua,
- STORAGE_SECRET_ACCESS_KEY=lokua_secret.

Migrations
TypeORM, synchronize: false. All schema changes go through migrations.

```
pnpm --filter api m:gen <Name>   # generate a migration from entity ↔ DB diff
pnpm --filter api m:run          # apply
pnpm --filter api m:revert       # revert the last one
pnpm --filter api m:show         # list applied/pending
pnpm --filter api m:drop         # drop the schema (dev only!)
```

Migrations live in src/db/migrations/. In dev TypeORM reads .ts directly; in production it runs compiled .js from dist/.

Testing
Test database is lokua_test (container lokua-db-test, port 5433), separate from the dev database lokua.

```
# Start the test database (if not running)
docker compose up -d db-test

# Run all tests
pnpm --filter api test

# Watch mode
pnpm --filter api test:watch

# Typecheck (no emit)
pnpm --filter api typecheck
```

Test layout:

```
tests/
├── unit/          # use cases, adapters, presentation helpers — on mocks
├── api/           # HTTP tests via supertest + createTestApp() (mocks)
└── integration/   # real lokua_test (repositories, transactions, cascades)
```

### Quick diagnostics

| Command                               | Checks                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm --filter api check:db`          | Reads `DATABASE_URL`. Checks connectivity, PostGIS, UUID support, applied migrations, and required columns and indexes in a read-only transaction. Add `--test` to check `TEST_DATABASE_URL` or local `lokua_test`.                                                                                                      |
| `pnpm --filter api check:media`       | Uses local, generated images to check JPEG, PNG and WebP decoding, EXIF orientation, resizing, metadata stripping and invalid input. No object storage is needed.                                                                                                                                                        |
| `pnpm --filter api smoke:events`      | Runs read-only HTTP checks against a running API. Checks health, published OpenAPI, protected endpoints, invalid query parameters, the feed, map and guest event privacy. Uses `SMOKE_API_URL`, then `APP_URL`, then `http://localhost:3003`. Set `SMOKE_EVENT_ID` to require a particular public event.                 |
| `pnpm --filter api smoke:onboarding`  | Registers a test account, uploads a generated profile image, completes onboarding, checks the saved main photo and verifies logout. Requires `TEST_CITY_ID`, at least three comma-separated `TEST_INTEREST_IDS`, and a running test API with storage and email configured. Creates a user and an object in test storage. |
| `pnpm --filter api typecheck:scripts` | Type-checks the scripts with the API's ES2022 and NodeNext settings.                                                                                                                                                                                                                                                     |

Each diagnostic exits with a nonzero status on failure. The HTTP smoke check explicitly reports when it skips event detail because the feed is empty.

- vitest.config.ts uses fileParallelism: false to avoid TRUNCATE deadlocks in parallel integration files.
- Integration tests apply migrations once via global-setup.ts and refuse to run against the dev database lokua unless ALLOW_UNSAFE_TEST_DB is set. Use lokua_test or another dedicated test database.

OpenAPI / Scalar UI: /docs

The spec is assembled from docs/openapi/paths/_.yaml (one file per module) and docs/openapi/components/schemas/\**/_.yaml (one file per schema).

- loader — src/docs/openapi.loader.ts;
- builder — openapi.builder.ts.

To add a new module with HTTP endpoints, create paths/<module>.yaml and the schemas under components/schemas/ — they are picked up automatically.

### Production / deployment

Target infrastructure:

Backend: Render (long-lived Node.js, TCP to the DB)

Database: Neon (PostgreSQL)

Storage: Cloudflare R2 (S3-compatible)

Frontend: Cloudflare Pages

_Neon Runtime — pooled connection string (-pooler in the host) + ?sslmode=require&connect_timeout=10. PgBouncer runs in transaction mode, so extra.max in data-source.ts is capped at 10 to avoid double pooling._

_Migrations — direct connection string (no -pooler), because TypeORM migrations use session-level operations that PgBouncer in transaction mode does not support._

In Render:

- DATABASE_URL=<pooled>
- DATABASE_URL_DIRECT=<direct>

Migrations in production:

```
DATABASE_URL=$DATABASE_URL_DIRECT pnpm --filter api m:run:prod
```

Run once per deploy (Render pre-deploy command or manually).

Cloudflare R2

- STORAGE_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
- STORAGE_REGION=auto
- STORAGE_FORCE_PATH_STYLE=false

_Bucket — same as local (lokua-uploads) or a dedicated production bucket._

Render

- Build: pnpm install && pnpm --filter api build
- Start: pnpm --filter api start (runs dist/server.js)

_Health check path: /health_

_Graceful shutdown: server.ts handles SIGTERM/SIGINT — closes the HTTP server, waits for in-flight requests, closes DataSource, and forces exit after 10 s._

| Script         | Description                                   |
| -------------- | --------------------------------------------- |
| `dev`          | `tsx watch src/server.ts`                     |
| `build`        | `tsc` → `dist/`                               |
| `start`        | `node dist/server.js`                         |
| `test`         | Vitest (run once)                             |
| `test:watch`   | Vitest (watch mode)                           |
| `lint`         | ESLint                                        |
| `lint:fix`     | ESLint with `--fix`                           |
| `format`       | Prettier write                                |
| `format:check` | Prettier check                                |
| `typecheck`    | `tsc --noEmit -p tsconfig.test.json`          |
| `m:gen`        | Generate a migration (dev)                    |
| `m:run`        | Apply migrations (dev)                        |
| `m:revert`     | Revert the last migration (dev)               |
| `m:drop`       | Drop the schema (dev only!)                   |
| `m:show`       | List applied/pending migrations (dev)         |
| `m:run:prod`   | Apply migrations in production (from `dist/`) |
