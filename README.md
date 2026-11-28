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

Install Node.js, pnpm and Docker Compose, then run from the repository root.

```bash
pnpm setup:local
pnpm --filter api dev
```

Run `pnpm --filter api smoke:lifecycle` for an isolated test of the event flow.
