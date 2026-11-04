# Heat Championship Companion

Angular SPA companion for *Heat: Pedal to the Metal* leagues — BYOS (Bring Your Own Supabase).

## Stack

- Angular 19 + Tailwind CSS
- Supabase (PostgreSQL + Auth + RLS)
- Hash routing for GitHub Pages
- pt-BR / EN + light / dark themes inspired by the official rulebooks

## Quick start

```bash
npm install
npm start
```

Open `http://localhost:4200`.

## Supabase setup (BYOS)

1. Create a Supabase project.
2. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql)
   (new projects) or the scripts in [`supabase/migrations/`](supabase/migrations/)
   in order if upgrading an existing database.
3. Create a Host user in **Authentication → Users**.
4. Copy **Project URL** and **publishable** key from **Project Settings → API Keys**
   (`sb_publishable_…`). Legacy `anon` keys still work during Supabase’s migration window.
5. Open the app landing page → **Access your league** (`/connect`):
   - **Guest:** URL + publishable key (read-only).
   - **Host:** URL + publishable key + email/password (full write access).

Sessions expire after 24 hours and are stored in `localStorage`.

## V1 features

- Marketing landing → connect / Guest / Host authentication
- Dashboard with standings, driver form, car telemetry
- CRUD for cars, drivers, tracks, championships
- Log Race (championship or standalone)
- Legend car lock, unique grid/finish validation, auto points
- Bilingual UI (pt-BR / EN) and light / dark themes

## Build & deploy (GitHub Pages)

```bash
npm run build
```

Publish `dist/heat-championship/browser`. Hash routing (`/#/...`) avoids refresh 404s on Pages.

For a project site, set the base href when building:

```bash
npx ng build --base-href /YOUR_REPO_NAME/
```
