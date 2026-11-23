-- Domain evolution: associations, scoring systems, track corners,
-- garage upgrades, race stages/telemetry, badges.

-- Associations (social leagues / leagues)
create table if not exists public.associations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  abbreviation varchar(8) not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.association_members (
  association_id uuid not null references public.associations(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (association_id, driver_id)
);

-- Named scoring systems (championship default + per-race override)
create table if not exists public.scoring_systems (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  points integer[] not null,
  bonus_fastest_lap int not null default 0,
  bonus_pole int not null default 0,
  bonus_driver_of_day int not null default 0,
  is_builtin boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now())
);

insert into public.scoring_systems (name, points, bonus_fastest_lap, bonus_pole, bonus_driver_of_day, is_builtin)
select 'Heat Official', array[9,6,4,3,2,1], 0, 0, 0, true
where not exists (select 1 from public.scoring_systems where name = 'Heat Official');

insert into public.scoring_systems (name, points, bonus_fastest_lap, bonus_pole, bonus_driver_of_day, is_builtin)
select 'F1 Style', array[25,18,15,12,10,8,6,4,2,1], 1, 0, 0, true
where not exists (select 1 from public.scoring_systems where name = 'F1 Style');

-- Garage upgrade cards
create table if not exists public.garage_upgrades (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null check (category in ('engine','suspension','brakes','tires','cooling','other')),
  heat_cost int not null default 0,
  effect text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Track geometry
alter table public.tracks
  add column if not exists length_spaces int,
  add column if not exists laps int,
  add column if not exists corners jsonb not null default '[]'::jsonb;

-- Championship association + scoring FK (point_system kept for compatibility)
alter table public.championships
  add column if not exists association_id uuid references public.associations(id) on delete set null,
  add column if not exists scoring_system_id uuid references public.scoring_systems(id) on delete set null;

-- Race identity, stage, reverse, telemetry, scoring override
alter table public.races drop constraint if exists races_status_check;
alter table public.races
  add column if not exists name text,
  add column if not exists abbreviation varchar(8),
  add column if not exists association_id uuid references public.associations(id) on delete set null,
  add column if not exists scoring_system_id uuid references public.scoring_systems(id) on delete set null,
  add column if not exists reverse_direction boolean not null default false,
  add column if not exists stage text not null default 'pre_race'
    check (stage in ('pre_race','in_race','post_race')),
  add column if not exists telemetry jsonb not null default '[]'::jsonb,
  add column if not exists entries jsonb not null default '[]'::jsonb;

alter table public.races
  add constraint races_status_check
  check (status in ('planned','pre_race','in_race','post_race','completed','cancelled'));

-- Result extras for podium stage
alter table public.race_results
  add column if not exists gap_turns int not null default 0,
  add column if not exists driver_of_the_day boolean not null default false,
  add column if not exists loadout jsonb not null default '[]'::jsonb;

-- Badges
create table if not exists public.badge_definitions (
  id text primary key,
  name text not null,
  description text not null,
  metric text not null
);

create table if not exists public.badge_awards (
  id uuid default gen_random_uuid() primary key,
  badge_id text not null references public.badge_definitions(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  race_id uuid references public.races(id) on delete set null,
  association_id uuid references public.associations(id) on delete set null,
  awarded_at timestamptz not null default timezone('utc'::text, now())
);

insert into public.badge_definitions (id, name, description, metric) values
  ('vacuum_architect', 'O Arquiteto do Vácuo', 'Mais ultrapassagens via vácuo na corrida', 'slipstream_overtakes'),
  ('lead_foot', 'Pé de Chumbo', 'Mais passagens no limite de curva sem estourar', 'corner_speed_ok'),
  ('swiss_watch', 'Relógio Suíço', 'Turno mais rápido da prova', 'fastest_turn'),
  ('russian_roulette', 'Roleta Russa', 'Mais estouros/rodadas em curvas', 'corner_spins')
on conflict (id) do nothing;

-- RLS for new tables
alter table public.associations enable row level security;
alter table public.association_members enable row level security;
alter table public.scoring_systems enable row level security;
alter table public.garage_upgrades enable row level security;
alter table public.badge_definitions enable row level security;
alter table public.badge_awards enable row level security;

create policy "Public Read Associations" on public.associations for select using (true);
create policy "Public Read Association Members" on public.association_members for select using (true);
create policy "Public Read Scoring Systems" on public.scoring_systems for select using (true);
create policy "Public Read Garage Upgrades" on public.garage_upgrades for select using (true);
create policy "Public Read Badge Definitions" on public.badge_definitions for select using (true);
create policy "Public Read Badge Awards" on public.badge_awards for select using (true);

create policy "Auth Write Associations" on public.associations for all to authenticated using (true) with check (true);
create policy "Auth Write Association Members" on public.association_members for all to authenticated using (true) with check (true);
create policy "Auth Write Scoring Systems" on public.scoring_systems for all to authenticated using (true) with check (true);
create policy "Auth Write Garage Upgrades" on public.garage_upgrades for all to authenticated using (true) with check (true);
create policy "Auth Write Badge Awards" on public.badge_awards for all to authenticated using (true) with check (true);
