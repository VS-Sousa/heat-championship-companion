create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_text text not null,
  role text not null default 'host' check (role in ('host', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists cars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color_key text not null,
  color_hex text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nickname text,
  abbreviation varchar(3) not null unique,
  number int not null check (number between 0 and 99),
  is_legend boolean not null default false,
  fixed_car_id uuid references cars(id) on delete set null,
  favorite_car_id uuid references cars(id) on delete set null,
  user_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists associations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  abbreviation varchar(8) not null,
  created_at timestamptz not null default now()
);

create table if not exists association_members (
  association_id uuid not null references associations(id) on delete cascade,
  driver_id uuid not null references drivers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (association_id, driver_id)
);

create table if not exists scoring_systems (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  points integer[] not null,
  bonus_fastest_lap int not null default 0,
  bonus_pole int not null default 0,
  bonus_driver_of_day int not null default 0,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now()
);

insert into scoring_systems (
  name, points, bonus_fastest_lap, bonus_pole, bonus_driver_of_day, is_builtin
)
select 'Heat Official', array[9,6,4,3,2,1], 0, 0, 0, true
where not exists (select 1 from scoring_systems where name = 'Heat Official');

insert into scoring_systems (
  name, points, bonus_fastest_lap, bonus_pole, bonus_driver_of_day, is_builtin
)
select 'F1 Style', array[25,18,15,12,10,8,6,4,2,1], 1, 0, 0, true
where not exists (select 1 from scoring_systems where name = 'F1 Style');

create table if not exists garage_upgrades (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('engine','suspension','brakes','tires','cooling','other')),
  heat_cost int not null default 0,
  effect text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  length_spaces int,
  laps int,
  corners jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists championships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season text not null,
  series_id uuid not null default gen_random_uuid(),
  edition_number int not null default 1,
  point_system integer[] not null,
  association_id uuid references associations(id) on delete set null,
  scoring_system_id uuid references scoring_systems(id) on delete set null,
  use_garage boolean default false,
  use_events boolean default false,
  use_press boolean default false,
  use_sponsorship boolean default false,
  is_active boolean default true,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (series_id, edition_number)
);

create table if not exists races (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid references championships(id) on delete cascade,
  track_id uuid references tracks(id) on delete restrict,
  round_number int,
  name text,
  abbreviation varchar(8),
  association_id uuid references associations(id) on delete set null,
  scoring_system_id uuid references scoring_systems(id) on delete set null,
  race_type text not null default 'championship' check (race_type in ('championship','standalone')),
  status text not null default 'completed'
    check (status in ('planned','pre_race','in_race','post_race','completed','cancelled')),
  reverse_direction boolean not null default false,
  stage text not null default 'pre_race' check (stage in ('pre_race','in_race','post_race')),
  telemetry jsonb not null default '[]'::jsonb,
  entries jsonb not null default '[]'::jsonb,
  weather_condition text,
  track_condition text,
  raced_at date,
  created_at timestamptz not null default now()
);

create table if not exists race_results (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references races(id) on delete cascade,
  driver_id uuid not null references drivers(id) on delete cascade,
  car_id uuid not null references cars(id) on delete cascade,
  grid_position int not null,
  position int not null,
  points_awarded int not null default 0,
  dnf boolean not null default false,
  gap_turns int not null default 0,
  driver_of_the_day boolean not null default false,
  loadout jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (race_id, driver_id),
  unique (race_id, car_id),
  unique (race_id, grid_position),
  unique (race_id, position)
);

create table if not exists badge_definitions (
  id text primary key,
  name text not null,
  description text not null,
  metric text not null
);

create table if not exists badge_awards (
  id uuid primary key default gen_random_uuid(),
  badge_id text not null references badge_definitions(id) on delete cascade,
  driver_id uuid not null references drivers(id) on delete cascade,
  race_id uuid references races(id) on delete set null,
  association_id uuid references associations(id) on delete set null,
  awarded_at timestamptz not null default now()
);

insert into badge_definitions (id, name, description, metric) values
  ('vacuum_architect', 'O Arquiteto do Vácuo', 'Mais ultrapassagens via vácuo na corrida', 'slipstream_overtakes'),
  ('lead_foot', 'Pé de Chumbo', 'Mais passagens no limite de curva sem estourar', 'corner_speed_ok'),
  ('swiss_watch', 'Relógio Suíço', 'Turno mais rápido da prova', 'fastest_turn'),
  ('russian_roulette', 'Roleta Russa', 'Mais estouros/rodadas em curvas', 'corner_spins')
on conflict (id) do nothing;

insert into profiles (username, password_text, role)
values ('host', 'host', 'host') on conflict (username) do nothing;
