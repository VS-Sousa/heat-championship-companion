-- Championships no longer belong to an association.
alter table public.championships drop column if exists association_id;
