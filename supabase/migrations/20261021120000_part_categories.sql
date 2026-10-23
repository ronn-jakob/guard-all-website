-- Inventory categories become managed records so each one can carry the prefix
-- used to generate item codes (DMP-007). parts.category stays as the display
-- text every read path already uses; parts.category_id is the durable link.

create table if not exists public.part_categories (
  category_id uuid primary key default gen_random_uuid(),
  name text not null,
  code_prefix text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(user_id)
);

alter table public.part_categories enable row level security;

create unique index if not exists part_categories_name_key
  on public.part_categories (lower(name));
create unique index if not exists part_categories_prefix_key
  on public.part_categories (upper(code_prefix));

alter table public.parts
  add column if not exists category_id uuid references public.part_categories(category_id);
create index if not exists parts_category_id_idx on public.parts (category_id);

-- Seed the categories the ledger already uses, preserving their spelling so the
-- one 'misc' part still matches. Prefixes are editable in Manage categories;
-- existing SKUs are never rewritten.
insert into public.part_categories (name, code_prefix)
select seed.name, seed.code_prefix
from (values
  ('Access', 'ACC'),
  ('Intrusion', 'INT'),
  ('Power', 'PWR'),
  ('CCTV', 'CCTV'),
  ('misc', 'MSC')
) as seed(name, code_prefix)
where not exists (
  select 1 from public.part_categories existing
  where lower(existing.name) = lower(seed.name)
);

update public.parts part
set category_id = category.category_id
from public.part_categories category
where part.category_id is null
  and part.category is not null
  and lower(trim(part.category)) = lower(category.name);

-- Category changes appear in the audit log like every other business table.
create or replace function public.gioms_write_audit_log_categories()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
declare
  old_row jsonb;
  new_row jsonb;
  chosen_row jsonb;
  chosen_id uuid;
  chosen_key jsonb;
  actor_id uuid;
begin
  actor_id := public.gioms_current_actor();

  if tg_op = 'DELETE' then
    old_row := to_jsonb(old);
    chosen_row := old_row;
  else
    new_row := to_jsonb(new);
    chosen_row := new_row;
  end if;

  chosen_id := (chosen_row ->> 'category_id')::uuid;
  chosen_key := jsonb_build_object('category_id', chosen_id);

  insert into audit_log
    (table_name, record_id, record_key, action, changed_by,
     changed_at, old_values, new_values)
  values
    ('part_categories', chosen_id, chosen_key, lower(tg_op)::audit_action,
     actor_id, now(), old_row, new_row);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.gioms_write_audit_log_categories() from public;
revoke all on function public.gioms_write_audit_log_categories() from anon;
revoke all on function public.gioms_write_audit_log_categories() from authenticated;
grant execute on function public.gioms_write_audit_log_categories() to service_role;

drop trigger if exists trg_audit_part_categories on public.part_categories;
create trigger trg_audit_part_categories
  after insert or update or delete on public.part_categories
  for each row execute function public.gioms_write_audit_log_categories();
