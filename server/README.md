# Local API

Express/TypeScript/PostgreSQL REST API for Heat Championship Companion.

## Docker

```bash
docker compose up --build
```

The API is available at `http://localhost:3000`; PostgreSQL is exposed on port 5432.
The initial host login is `host` / `host`. To re-run schema initialization after
changing `schema.sql`, use `docker compose down -v` before starting again.

## Development outside Docker

Start only PostgreSQL (`docker compose up db`), then:

```bash
cd server
npm install
npm run dev
```

The default database URL is `postgres://heat:heat@localhost:5432/heat`. Override it
with `DATABASE_URL`. Other scripts are `npm run build`, `npm start`, and
`npm run typecheck`.

## Authentication

`GET /api/health` and `/api/auth/*` are public. All domain routes require
`Authorization: Bearer local-guest` (read-only) or
`Authorization: Bearer local-host` (read/write).

## Deploy note

GitHub Pages builds **only** the Angular SPA at the repository root
(`ng build` → `dist/heat-championship/browser`). Nothing under `server/` is published.
