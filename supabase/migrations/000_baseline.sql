-- Heat Championship Companion — Supabase schema + RLS
-- Canonical baseline. Run in the Supabase SQL Editor of your BYOS project.
-- Future changes: add incremental files under supabase/migrations/.

-- 1. Profiles (Tied to auth.users for RBAC management)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  role text not null check (role in ('host', 'admin')) default 'host',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'host'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Cars
create table public.cars (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  color_key text not null,
  color_hex text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Drivers (number/abbreviation live on championship_entries)
create table public.drivers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  nickname text,
  is_legend boolean default false not null,
  fixed_car_id uuid references public.cars(id) on delete set null,
  favorite_car_id uuid references public.cars(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Associations (name only required)
create table public.associations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.association_members (
  association_id uuid references public.associations(id) on delete cascade not null,
  driver_id uuid references public.drivers(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (association_id, driver_id)
);

-- Legends cannot join associations
create or replace function public.reject_legend_association_member()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.drivers d where d.id = new.driver_id and d.is_legend) then
    raise exception 'Legend drivers cannot be association members';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reject_legend_association_member on public.association_members;
create trigger trg_reject_legend_association_member
  before insert or update on public.association_members
  for each row execute procedure public.reject_legend_association_member();

-- 5. Scoring Systems
create table public.scoring_systems (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  points integer[] not null,
  bonus_fastest_lap int default 0 not null,
  bonus_pole int default 0 not null,
  bonus_driver_of_day int default 0 not null,
  is_builtin boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into public.scoring_systems (
  name, points, bonus_fastest_lap, bonus_pole, bonus_driver_of_day, is_builtin
)
select 'Heat Official', array[9,6,4,3,2,1], 0, 0, 0, true
where not exists (select 1 from public.scoring_systems where name = 'Heat Official');

insert into public.scoring_systems (
  name, points, bonus_fastest_lap, bonus_pole, bonus_driver_of_day, is_builtin
)
select 'F1 Style', array[25,18,15,12,10,8,6,4,2,1], 1, 0, 0, true
where not exists (select 1 from public.scoring_systems where name = 'F1 Style');

-- 6. Garage Upgrades
create table public.garage_upgrades (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null check (category in ('engine', 'suspension', 'brakes', 'tires', 'cooling', 'other')),
  heat_cost int default 0 not null,
  effect text default '' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Tracks
create table public.tracks (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  country text not null,
  length_spaces int,
  laps int,
  corners jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Championships (scoring_system_id required)
create table public.championships (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  season text not null,
  series_id uuid not null default gen_random_uuid(),
  edition_number int not null default 1,
  point_system integer[] not null,
  association_id uuid references public.associations(id) on delete set null,
  scoring_system_id uuid references public.scoring_systems(id) on delete restrict not null,
  use_garage boolean default false,
  use_events boolean default false,
  use_press boolean default false,
  use_sponsorship boolean default false,
  is_active boolean default true,
  finished_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (series_id, edition_number)
);

-- 8b. Cars entered in a championship
create table public.championship_cars (
  championship_id uuid references public.championships(id) on delete cascade not null,
  car_id uuid references public.cars(id) on delete restrict not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (championship_id, car_id)
);

-- 8c. Driver registrations (championship-scoped number/abbreviation/car)
create table public.championship_entries (
  id uuid default gen_random_uuid() primary key,
  championship_id uuid references public.championships(id) on delete cascade not null,
  driver_id uuid references public.drivers(id) on delete cascade not null,
  car_id uuid references public.cars(id) on delete restrict not null,
  number int not null check (number >= 0 and number <= 99),
  abbreviation varchar(3) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (championship_id, driver_id),
  unique (championship_id, car_id),
  unique (championship_id, number),
  unique (championship_id, abbreviation)
);

-- 8d. Garage upgrades owned by a human entry (mutable until championship finalize)
create table public.championship_entry_upgrades (
  entry_id uuid references public.championship_entries(id) on delete cascade not null,
  garage_upgrade_id uuid references public.garage_upgrades(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (entry_id, garage_upgrade_id)
);

-- 9. Races (scoring_system_id for standalone only)
create table public.races (
  id uuid default gen_random_uuid() primary key,
  championship_id uuid references public.championships(id) on delete cascade,
  track_id uuid references public.tracks(id) on delete restrict,
  round_number int,
  name text,
  abbreviation varchar(8),
  association_id uuid references public.associations(id) on delete set null,
  scoring_system_id uuid references public.scoring_systems(id) on delete set null,
  race_type text not null check (race_type in ('championship', 'standalone')) default 'championship',
  status text not null
    check (status in ('planned', 'pre_race', 'in_race', 'post_race', 'completed', 'cancelled'))
    default 'completed',
  reverse_direction boolean default false not null,
  stage text not null check (stage in ('pre_race', 'in_race', 'post_race')) default 'pre_race',
  telemetry jsonb default '[]'::jsonb not null,
  entries jsonb default '[]'::jsonb not null,
  weather_condition text,
  track_condition text,
  raced_at date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. Race Results (no DNF)
create table public.race_results (
  id uuid default gen_random_uuid() primary key,
  race_id uuid references public.races(id) on delete cascade not null,
  driver_id uuid references public.drivers(id) on delete cascade not null,
  car_id uuid references public.cars(id) on delete cascade not null,
  grid_position int not null,
  position int not null,
  points_awarded int default 0 not null,
  gap_turns int default 0 not null,
  driver_of_the_day boolean default false not null,
  loadout jsonb default '[]'::jsonb not null,
  -- Standalone race identity (championship uses championship_entries)
  number int check (number is null or (number >= 0 and number <= 99)),
  abbreviation varchar(3),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 11. Badges
create table public.badge_definitions (
  id text primary key,
  name text not null,
  description text not null,
  metric text not null
);

create table public.badge_awards (
  id uuid default gen_random_uuid() primary key,
  badge_id text references public.badge_definitions(id) on delete cascade not null,
  driver_id uuid references public.drivers(id) on delete cascade not null,
  race_id uuid references public.races(id) on delete set null,
  association_id uuid references public.associations(id) on delete set null,
  awarded_at timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into public.badge_definitions (id, name, description, metric) values
  ('vacuum_architect', 'O Arquiteto do Vácuo', 'Mais ultrapassagens via vácuo na corrida', 'slipstream_overtakes'),
  ('lead_foot', 'Pé de Chumbo', 'Mais passagens no limite de curva sem estourar', 'corner_speed_ok'),
  ('swiss_watch', 'Relógio Suíço', 'Turno mais rápido da prova', 'fastest_turn'),
  ('russian_roulette', 'Roleta Russa', 'Mais estouros/rodadas em curvas', 'corner_spins')
on conflict (id) do nothing;

-- RLS
alter table public.profiles enable row level security;
alter table public.cars enable row level security;
alter table public.drivers enable row level security;
alter table public.associations enable row level security;
alter table public.association_members enable row level security;
alter table public.scoring_systems enable row level security;
alter table public.garage_upgrades enable row level security;
alter table public.tracks enable row level security;
alter table public.championships enable row level security;
alter table public.championship_cars enable row level security;
alter table public.championship_entries enable row level security;
alter table public.championship_entry_upgrades enable row level security;
alter table public.races enable row level security;
alter table public.race_results enable row level security;
alter table public.badge_definitions enable row level security;
alter table public.badge_awards enable row level security;

create policy "Public Read Profiles" on public.profiles for select using (true);
create policy "Public Read Cars" on public.cars for select using (true);
create policy "Public Read Drivers" on public.drivers for select using (true);
create policy "Public Read Associations" on public.associations for select using (true);
create policy "Public Read Association Members" on public.association_members for select using (true);
create policy "Public Read Scoring Systems" on public.scoring_systems for select using (true);
create policy "Public Read Garage Upgrades" on public.garage_upgrades for select using (true);
create policy "Public Read Tracks" on public.tracks for select using (true);
create policy "Public Read Championships" on public.championships for select using (true);
create policy "Public Read Championship Cars" on public.championship_cars for select using (true);
create policy "Public Read Championship Entries" on public.championship_entries for select using (true);
create policy "Public Read Championship Entry Upgrades" on public.championship_entry_upgrades for select using (true);
create policy "Public Read Races" on public.races for select using (true);
create policy "Public Read Race Results" on public.race_results for select using (true);
create policy "Public Read Badge Definitions" on public.badge_definitions for select using (true);
create policy "Public Read Badge Awards" on public.badge_awards for select using (true);

create policy "Auth Write Cars" on public.cars for all to authenticated using (true) with check (true);
create policy "Auth Write Drivers" on public.drivers for all to authenticated using (true) with check (true);
create policy "Auth Write Associations" on public.associations for all to authenticated using (true) with check (true);
create policy "Auth Write Association Members" on public.association_members for all to authenticated using (true) with check (true);
create policy "Auth Write Scoring Systems" on public.scoring_systems for all to authenticated using (true) with check (true);
create policy "Auth Write Garage Upgrades" on public.garage_upgrades for all to authenticated using (true) with check (true);
create policy "Auth Write Tracks" on public.tracks for all to authenticated using (true) with check (true);
create policy "Auth Write Championships" on public.championships for all to authenticated using (true) with check (true);
create policy "Auth Write Championship Cars" on public.championship_cars for all to authenticated using (true) with check (true);
create policy "Auth Write Championship Entries" on public.championship_entries for all to authenticated using (true) with check (true);
create policy "Auth Write Championship Entry Upgrades" on public.championship_entry_upgrades for all to authenticated using (true) with check (true);
create policy "Auth Write Races" on public.races for all to authenticated using (true) with check (true);
create policy "Auth Write Race Results" on public.race_results for all to authenticated using (true) with check (true);
create policy "Auth Write Badge Awards" on public.badge_awards for all to authenticated using (true) with check (true);

create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
