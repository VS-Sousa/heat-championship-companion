-- Prefer unique hex colors; color_key stores normalized hex for uniqueness

alter table public.cars
  drop constraint if exists cars_color_key_key;

update public.cars
set color_key = lower(color_hex)
where color_hex is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cars_color_hex_key'
  ) then
    alter table public.cars add constraint cars_color_hex_key unique (color_hex);
  end if;
end $$;
