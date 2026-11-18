# Local API (future)

Placeholder for the Heat Championship Companion local backend.

When implemented, this service will expose the same domain contract as `DataProvider`
(`cars`, `drivers`, `tracks`, `championships`, `races`) over HTTP so the Angular SPA
can run with `environment.storageMode = 'local'`.

## Planned stack

- HTTP API (Node or .NET — TBD)
- PostgreSQL via Docker Compose at the repo root
- Same relational shape as [`../supabase/schema.sql`](../supabase/schema.sql)

## Local development (when ready)

```bash
# from repo root
docker compose up -d
cd server && npm install && npm run start:dev
```

Then run the SPA with `storageMode: 'local'` and `apiBaseUrl: 'http://localhost:3000'`.

## Deploy note

GitHub Pages builds **only** the Angular SPA at the repository root
(`ng build` → `dist/heat-championship/browser`). Nothing under `server/` is published.
