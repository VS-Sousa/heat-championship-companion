# Heat Championship Companion

Angular SPA companion for *Heat: Pedal to the Metal* leagues — BYOS (Bring Your Own Supabase).

## Stack

- Angular 19 + Tailwind CSS
- Supabase (PostgreSQL + Auth + RLS)
- Hash routing for GitHub Pages

## Quick start

```bash
npm install
npm start
```

Open `http://localhost:4200`.

## Supabase setup (BYOS)

1. Create a Supabase project.
2. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql).
3. Create a Host user in **Authentication → Users**.
4. Copy **Project URL** and **anon public** key from **Project Settings → API**.
5. In the app `/connect` screen:
   - **Guest:** URL + anon key (read-only).
   - **Host:** URL + anon key + email/password (full write access).

Sessions expire after 24 hours and are stored in `localStorage`.

## V1 features

- Connect / Guest / Host authentication
- Dashboard with standings, driver form, car telemetry
- CRUD for cars, drivers, tracks, championships
- Log Race (championship or standalone)
- Legend car lock, unique grid/finish validation, auto points

## Build & deploy (GitHub Pages)

```bash
npm run build
```

Publish `dist/heat-championship/browser`. Hash routing (`/#/...`) avoids refresh 404s on Pages.

For a project site, set the base href when building:

```bash
npx ng build --base-href /YOUR_REPO_NAME/
```
