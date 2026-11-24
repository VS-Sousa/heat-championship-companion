-- 007: Garage upgrades — replace category/heat_cost/effect with description + set
-- Idempotent: safe on databases created from 000_baseline.sql or schema.sql.

do $$
begin
  -- effect -> description
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'garage_upgrades' and column_name = 'effect'
  ) then
    alter table public.garage_upgrades add column if not exists description text not null default '';
    update public.garage_upgrades set description = effect;
    alter table public.garage_upgrades drop column effect;
  else
    alter table public.garage_upgrades add column if not exists description text not null default '';
  end if;

  -- set column + check constraint
  alter table public.garage_upgrades add column if not exists "set" text not null default 'basegame';
  alter table public.garage_upgrades drop constraint if exists garage_upgrades_set_check;
  alter table public.garage_upgrades add constraint garage_upgrades_set_check
    check ("set" in ('basegame', 'heavy_rain', 'tunnel_vision', 'rocky_roads', 'homebrew'));

  -- drop legacy columns (also drops the category check constraint)
  alter table public.garage_upgrades drop column if exists category;
  alter table public.garage_upgrades drop column if exists heat_cost;
end $$;
