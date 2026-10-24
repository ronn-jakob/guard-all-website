
-- Stock movements are append-only, so a part that ever held stock can never be
-- deleted. Archiving hides it from the catalogue while keeping its history.
alter table public.parts add column if not exists is_active boolean not null default true;
create index if not exists idx_parts_is_active on public.parts(is_active);
;
