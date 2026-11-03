-- Heat Championship Companion — Supabase schema + RLS
-- Run this in the Supabase SQL Editor of your BYOS project.

-- 1. Profiles (Tied to auth.users for RBAC management)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  role text not null check (role in ('host', 'admin')) default 'host',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Auto-create profile on signup
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
  color_hex text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Drivers
create table public.drivers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  abbreviation varchar(3) not null unique,
  number int not null check (number >= 0 and number <= 99),
  is_legend boolean default false not null,
  fixed_car_id uuid references public.cars(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tracks
create table public.tracks (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  country text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Championships
create table public.championships (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  season text not null,
  point_system integer[] not null,
  use_garage boolean default false,
  use_weather boolean default false,
  use_legends boolean default false,
  use_heavy_rain boolean default false,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Races
create table public.races (
  id uuid default gen_random_uuid() primary key,
  championship_id uuid references public.championships(id) on delete cascade,
  track_id uuid references public.tracks(id) on delete restrict not null,
  round_number int,
  race_type text not null check (race_type in ('championship', 'standalone')) default 'championship',
  weather_condition text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Race Results
create table public.race_results (
  id uuid default gen_random_uuid() primary key,
  race_id uuid references public.races(id) on delete cascade not null,
  driver_id uuid references public.drivers(id) on delete cascade not null,
  car_id uuid references public.cars(id) on delete cascade not null,
  grid_position int not null,
  position int not null,
  points_awarded int default 0 not null,
  dnf boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.profiles enable row level security;
alter table public.cars enable row level security;
alter table public.drivers enable row level security;
alter table public.tracks enable row level security;
alter table public.championships enable row level security;
alter table public.races enable row level security;
alter table public.race_results enable row level security;

create policy "Public Read Profiles" on public.profiles for select using (true);
create policy "Public Read Cars" on public.cars for select using (true);
create policy "Public Read Drivers" on public.drivers for select using (true);
create policy "Public Read Tracks" on public.tracks for select using (true);
create policy "Public Read Championships" on public.championships for select using (true);
create policy "Public Read Races" on public.races for select using (true);
create policy "Public Read Race Results" on public.race_results for select using (true);

create policy "Auth Write Cars" on public.cars for all to authenticated using (true) with check (true);
create policy "Auth Write Drivers" on public.drivers for all to authenticated using (true) with check (true);
create policy "Auth Write Tracks" on public.tracks for all to authenticated using (true) with check (true);
create policy "Auth Write Championships" on public.championships for all to authenticated using (true) with check (true);
create policy "Auth Write Races" on public.races for all to authenticated using (true) with check (true);
create policy "Auth Write Race Results" on public.race_results for all to authenticated using (true) with check (true);

-- Authenticated users can read/update own profile; admins can manage roles later in dashboard/SQL
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
