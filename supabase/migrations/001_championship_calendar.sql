-- Migration: calendar, series, race status, nicknames
-- Run in SQL Editor if you already applied the previous schema.

alter table public.drivers
  add column if not exists nickname text;

alter table public.championships
  add column if not exists series_id uuid,
  add column if not exists edition_number int,
  add column if not exists finished_at timestamp with time zone;

update public.championships
set series_id = coalesce(series_id, gen_random_uuid()),
    edition_number = coalesce(edition_number, 1)
where series_id is null or edition_number is null;

alter table public.championships
  alter column series_id set default gen_random_uuid(),
  alter column series_id set not null,
  alter column edition_number set default 1,
  alter column edition_number set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'championships_series_id_edition_number_key'
  ) then
    alter table public.championships
      add constraint championships_series_id_edition_number_key
      unique (series_id, edition_number);
  end if;
end $$;

alter table public.races
  alter column track_id drop not null;

alter table public.races
  add column if not exists status text,
  add column if not exists raced_at date;

update public.races
set status = coalesce(status, 'completed')
where status is null;

alter table public.races
  alter column status set default 'completed',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'races_status_check'
  ) then
    alter table public.races
      add constraint races_status_check
      check (status in ('planned', 'completed', 'cancelled'));
  end if;
end $$;
