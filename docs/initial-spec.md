# SPEC KIT: Heat Championship Companion (BYOS - Bring Your Own Supabase)

---

## 1. System Overview & Architectural Boundaries

### 1.1 Context & Objective
* **Project Name:** Heat Championship Companion
* **Domain:** Board game companion application for *Heat: Pedal to the Metal*.
* **Objective:** Provide a light, responsive web tool to manage leagues, championships, standalone races, track player/car statistics, and maintain telemetry across board game sessions.
* **UI/UX Directive:** Respect the visual identity and retro mid-century vintage racing aesthetic of *Heat: Pedal to the Metal* (vibrant 1960s color palette, bold retro typography, dashboard-style UI elements using Tailwind CSS).

### 1.2 Technical Stack & Hosting Constraints
* **Frontend:** Single Page Application (SPA) built with **Angular** and styled with **Tailwind CSS**, hosted as static assets on **GitHub Pages**.
* **Backend:** User-provided **Supabase** instance (PostgreSQL, GoTrue Auth, Row Level Security).
* **BYOS Pattern (Bring Your Own Supabase):** 
  * The frontend is backend-agnostic.
  * The connection target is determined dynamically at runtime based on user-provided `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
* **Session Persistence:** Connection credentials and active authentication tokens are stored in browser `localStorage` with a strict **24-hour expiration window**.

---

## 2. User Roles & Authentication Architecture

### 2.1 Role Matrix

| Role | Required Auth Credentials | Capabilities |
| :--- | :--- | :--- |
| **Guest** | `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Read-only access to driver stats, car performance metrics, track data, and championship standings. No write access. |
| **Host** | `URL` + `Anon Key` + `Username` + `Password` | Full Read/Write access. Create championships, log race results, register tracks, manage cars and drivers. |
| **Admin** | `URL` + `Anon Key` + `Username` + `Password` | All Host permissions + User role assignment/management in Supabase instance. Cannot demote/delete original owner. |

### 2.2 Connection & Authentication Lifecycle
1. **Startup Check:** On initial load, app reads `session_expiry` from `localStorage`.
   * If `Date.now() > session_expiry` (or missing), clear local storage and redirect to `/connect`.
2. **Connect Screen:** User inputs `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
   * **Guest Entry:** Validates connection against target Supabase REST endpoint. If successful, sets session expiry (`Date.now() + 24 * 60 * 60 * 1000`) and opens public dashboard.
   * **Host/Admin Entry:** Collects `username` and `password`, authenticates against Supabase GoTrue Auth API, fetches `role` from `public.profiles`, and stores auth JWT alongside connection keys with the 24-hour expiry limit.

---

## 3. Database Schema & Supabase RLS Policies

Run the following SQL script directly in the target Supabase SQL Editor:

```sql
-- 1. Profiles (Tied to auth.users for RBAC management)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  role text not null check (role in ('host', 'admin')) default 'host',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Cars (Base game & expansion vehicles)
create table public.cars (
  id uuid default gen_random_uuid() primary key,
  name text not null,        -- e.g., "Red Arrow", "Blue Bolt"
  color_hex text not null,   -- Hex color for UI representation
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Drivers (Human players & Fixed Legends/Bots)
create table public.drivers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  abbreviation varchar(3) not null unique,               -- 3-letter badge (e.g., "ALO", "SEN")
  number int not null check (number >= 0 and number <= 99), -- 2-digit number (00-99)
  is_legend boolean default false not null,               -- Legend/Bot flag
  fixed_car_id uuid references public.cars(id) on delete set null, -- Required for Legends
  user_id uuid references public.profiles(id) on delete set null,  -- Optional binding to Auth profile
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tracks (Circuits registry)
create table public.tracks (
  id uuid default gen_random_uuid() primary key,
  name text not null,      -- e.g., "Monza", "Silverstone"
  country text not null,   -- e.g., "Italy", "Great Britain"
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Championships
create table public.championships (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  season text not null,
  point_system integer[] not null, -- Array of points per placement (e.g., [10, 8, 6, 5, 4, 3, 2, 1])
  
  -- Structured expansion modules configuration (all optional)
  use_garage boolean default false,
  use_weather boolean default false,
  use_legends boolean default false,
  use_heavy_rain boolean default false,
  
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Races (Championship rounds or Standalone sessions)
create table public.races (
  id uuid default gen_random_uuid() primary key,
  championship_id uuid references public.championships(id) on delete cascade, -- NULL for standalone races
  track_id uuid references public.tracks(id) on delete restrict not null,
  round_number int,
  race_type text not null check (race_type in ('championship', 'standalone')) default 'championship',
  
  -- Race specific module telemetry
  weather_condition text,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Race Results (Grid positions, finishes, points)
create table public.race_results (
  id uuid default gen_random_uuid() primary key,
  race_id uuid references public.races(id) on delete cascade not null,
  driver_id uuid references public.drivers(id) on delete cascade not null,
  car_id uuid references public.cars(id) on delete cascade not null,
  grid_position int not null,  -- Qualifying / Starting Grid Position
  position int not null,       -- Final Finishing Position
  points_awarded int default 0 not null,
  dnf boolean default false,   -- Did Not Finish (Engine blown / retired)
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ROW LEVEL SECURITY (RLS) POLICIES
alter table public.profiles enable row level security;
alter table public.cars enable row level security;
alter table public.drivers enable row level security;
alter table public.tracks enable row level security;
alter table public.championships enable row level security;
alter table public.races enable row level security;
alter table public.race_results enable row level security;

-- Public Read Policies (Allow Guests via Anon Key)
create policy "Public Read Profiles" on public.profiles for select using (true);
create policy "Public Read Cars" on public.cars for select using (true);
create policy "Public Read Drivers" on public.drivers for select using (true);
create policy "Public Read Tracks" on public.tracks for select using (true);
create policy "Public Read Championships" on public.championships for select using (true);
create policy "Public Read Races" on public.races for select using (true);
create policy "Public Read Race Results" on public.race_results for select using (true);

-- Authenticated Write Policies (Require Host / Admin Auth token)
create policy "Auth Write Cars" on public.cars for all to authenticated using (true);
create policy "Auth Write Drivers" on public.drivers for all to authenticated using (true);
create policy "Auth Write Tracks" on public.tracks for all to authenticated using (true);
create policy "Auth Write Championships" on public.championships for all to authenticated using (true);
create policy "Auth Write Races" on public.races for all to authenticated using (true);
create policy "Auth Write Race Results" on public.race_results for all to authenticated using (true);
```

---

## 4. Frontend Service Contracts & Domain Interfaces

Code generation agents MUST strictly adhere to the following TypeScript interfaces for data modeling and service interaction:

```typescript
// --- BYOS & Session Types ---
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface UserSession {
  config: SupabaseConfig;
  user: {
    id: string;
    username: string;
    role: 'guest' | 'host' | 'admin';
  } | null;
  expiresAt: number; // Date.now() + 24h timestamp
}

// --- Domain Models ---
export interface Car {
  id: string;
  name: string;
  colorHex: string;
}

export interface Driver {
  id: string;
  name: string;
  abbreviation: string; // 3 uppercase letters
  number: number;       // 0 - 99
  isLegend: boolean;
  fixedCarId?: string;
  userId?: string;
}

export interface Track {
  id: string;
  name: string;
  country: string;
}

export interface Championship {
  id: string;
  name: string;
  season: string;
  pointSystem: number[];
  useGarage: boolean;
  useWeather: boolean;
  useLegends: boolean;
  useHeavyRain: boolean;
  isActive: boolean;
}

export interface RaceResultPayload {
  driverId: string;
  carId: string;
  gridPosition: number;
  position: number;
  pointsAwarded: number;
  dnf: boolean;
}

export interface LogRaceRequest {
  championshipId?: string; // Null if standalone race
  trackId: string;
  raceType: 'championship' | 'standalone';
  weatherCondition?: string;
  results: RaceResultPayload[];
}
```

---

## 5. Key Use Cases & Interaction Workflows

### 5.1 [UC-01] Standalone Race vs Championship Logging
* Host navigates to **"Log Race"**.
* Chooses between **Championship Mode** or **Standalone Mode**:
  * If **Championship Mode**: Selects target active championship. The form reads the championship's module settings (e.g., if `use_weather` is true, display weather selector). Points are automatically calculated based on `championship.point_system`.
  * If **Standalone Mode**: `championship_id` is set to `null`. Points calculation is skipped or set to 0. Race statistics count towards driver/car global stats but do not update any championship table.

### 5.2 [UC-02] Legend / Bot Rules Enforcement
* When adding drivers to a race entry form, selecting a driver with `is_legend = true` MUST automatically lock their selected car to `driver.fixed_car_id`.
* Legend drivers cannot be reassigned to different cars during race logging.

### 5.3 [UC-03] Grid & Finishing Position Validation
* The race creation UI must implement front-end validation ensuring that:
  1. No two drivers share the same `grid_position`.
  2. No two drivers share the same `position` (unless DNF rules apply, but grid position must remain unique).
  3. No single driver or car is entered more than once in the same race.

---

## 6. Acceptance Criteria & Edge Cases

### 6.1 Acceptance Criteria
1. **[AC-01] BYOS Handshake:** Entering a valid Supabase URL & Anon Key must successfully instantiate the client dynamically and route to the dashboard.
2. **[AC-02] Session Expiry:** Any stored connection older than 24 hours must be automatically wiped on initialization, sending the user back to `/connect`.
3. **[AC-03] GitHub Pages Deployment Compatibility:** The build must be pure client-side static assets (Angular SPA). Hash routing (`RouterModule.forRoot(routes, { useHash: true })`) or single page fallback must be configured to prevent 404s on page refresh in GitHub Pages.
4. **[AC-04] RLS Security:** Guests using an Anon Key attempt to execute `INSERT`/`UPDATE`/`DELETE` calls must fail at the Database level via Supabase RLS.

### 6.2 Edge Cases to Handle in Code
* **Offline / Invalid Credentials:** Show user-friendly error banners on connection failure without freezing the UI.
* **Partial Races (DNFs):** Drivers marked as `dnf = true` still record their `grid_position` and participation stats, but score zero points unless specified by custom league rules.
* **Fixed Legend Binding:** Handle cases where a Legend driver's assigned car is deleted or missing gracefully in UI dropdowns.