-- Championship modules: Garage, Events, Press, Sponsorship
-- Weather / track condition live on each race, not as championship modules

alter table public.championships
  add column if not exists use_events boolean default false,
  add column if not exists use_press boolean default false,
  add column if not exists use_sponsorship boolean default false;

alter table public.championships
  drop column if exists use_weather,
  drop column if exists use_legends,
  drop column if exists use_heavy_rain;

alter table public.races
  add column if not exists track_condition text;
