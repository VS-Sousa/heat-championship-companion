-- Named car colors + driver favorite car

alter table public.cars
  add column if not exists color_key text;

update public.cars
set color_key = case lower(color_hex)
  when '#e1221c' then 'red'
  when '#e36a12' then 'orange'
  when '#f5c518' then 'yellow'
  when '#1f8a4c' then 'green'
  when '#1e5eff' then 'blue'
  when '#7b2cbf' then 'purple'
  when '#1a1a1a' then 'black'
  when '#f4f4f4' then 'white'
  when '#e85d8e' then 'pink'
  when '#00b7c7' then 'cyan'
  else 'red'
end
where color_key is null;

alter table public.cars
  alter column color_key set default 'red',
  alter column color_key set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cars_color_key_key'
  ) then
    alter table public.cars add constraint cars_color_key_key unique (color_key);
  end if;
end $$;

alter table public.drivers
  add column if not exists favorite_car_id uuid references public.cars(id) on delete set null;
