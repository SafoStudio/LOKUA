# LOKUA

Monorepo for LOKUA — a platform for organizing and attending events.

## Structure

```
LOKUA/
├── apps/
│ ├── api/ # backend
│ └── web/ # frontend
├── docker-compose.yml
└── package.json # pnpm workspace
```

## Applications

- [Backend (apps/api)](./apps/api) — REST API.
- [Frontend (apps/web)](./apps/web) — client application.

## Quick start

```bash
pnpm install
docker compose up -d
pnpm --filter api dev
```
