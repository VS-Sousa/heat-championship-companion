-- Result-based badges (evaluated from race_results on post-race completion).
insert into public.badge_definitions (id, name, description, metric) values
  ('pole_converter', 'Pole Convertida', 'Largou na pole e venceu a corrida', 'pole_conversions'),
  ('comeback_king', 'Rei da Virada', 'Maior ganho de posições entre o grid e a chegada', 'positions_gained'),
  ('clean_sweep', 'Hat-trick', 'Pole, vitória e piloto do dia na mesma corrida', 'clean_sweep')
on conflict (id) do nothing;
