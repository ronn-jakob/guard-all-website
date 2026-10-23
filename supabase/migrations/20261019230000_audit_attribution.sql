-- Audit attribution, template coverage, and read-path indexes.
--
-- Row-level audit triggers already existed, but every row landed with
-- changed_by = NULL: the trigger read the app.user_id GUC, and the Edge
-- Functions write through PostgREST with the service role, so that setting is
-- never present. gioms_current_actor() keeps the GUC as the first choice and
-- falls back to the x-guard-actor header that guard-auth/guard-account attach to
-- their PostgREST client. If the header is ever missing the result stays NULL
-- (unattributed) rather than failing the write.

create or replace function public.gioms_current_actor()
returns uuid
language sql
stable
set search_path = pg_catalog, public, pg_temp
as $$
  select coalesce(
    nullif(current_setting('app.user_id', true), '')::uuid,
    nullif(current_setting('request.headers', true)::jsonb ->> 'x-guard-actor', '')::uuid
  );
$$;

revoke all on function public.gioms_current_actor() from public;
revoke all on function public.gioms_current_actor() from anon;
revoke all on function public.gioms_current_actor() from authenticated;
grant execute on function public.gioms_current_actor() to service_role;

-- Point both existing audit trigger functions at the resolver. Rewriting the
-- stored definition keeps the 20 existing triggers attached and leaves every
-- other line (JSON snapshot, password_hash stripping, key mapping) untouched.
do $migration$
declare
  definition text;
  needle text := 'actor_id := NULLIF(current_setting(''app.user_id'', true), '''')::uuid;';
  replacement text := 'actor_id := public.gioms_current_actor();';
begin
  select pg_get_functiondef(p.oid)
    into definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'gioms_write_audit_log';

  if definition is null then
    raise exception 'gioms_write_audit_log() not found';
  end if;
  if position(needle in definition) = 0 then
    raise exception 'gioms_write_audit_log() does not contain the expected actor line';
  end if;

  execute replace(definition, needle, replacement);

  select pg_get_functiondef(p.oid)
    into definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'gioms_write_audit_log_migration002';

  if definition is null then
    raise exception 'gioms_write_audit_log_migration002() not found';
  end if;
  if position(needle in definition) = 0 then
    raise exception 'gioms_write_audit_log_migration002() does not contain the expected actor line';
  end if;

  execute replace(definition, needle, replacement);
end
$migration$;

-- Template pricing had no audit coverage at all. It gets its own trigger
-- function so the two existing functions (and their triggers) stay untouched.
create or replace function public.gioms_write_audit_log_templates()
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

  case tg_table_name
    when 'job_templates' then
      chosen_id := (chosen_row ->> 'template_id')::uuid;
      chosen_key := jsonb_build_object('template_id', chosen_id);
    when 'job_template_items' then
      chosen_id := (chosen_row ->> 'template_item_id')::uuid;
      chosen_key := jsonb_build_object(
        'template_item_id', chosen_id,
        'template_id', chosen_row -> 'template_id'
      );
    else
      raise exception 'Audit key mapping missing for table %', tg_table_name;
  end case;

  insert into audit_log
    (table_name, record_id, record_key, action, changed_by,
     changed_at, old_values, new_values)
  values
    (tg_table_name, chosen_id, chosen_key, lower(tg_op)::audit_action,
     actor_id, now(), old_row, new_row);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.gioms_write_audit_log_templates() from public;
revoke all on function public.gioms_write_audit_log_templates() from anon;
revoke all on function public.gioms_write_audit_log_templates() from authenticated;
grant execute on function public.gioms_write_audit_log_templates() to service_role;

drop trigger if exists trg_audit_job_templates on public.job_templates;
create trigger trg_audit_job_templates
  after insert or update or delete on public.job_templates
  for each row execute function public.gioms_write_audit_log_templates();

drop trigger if exists trg_audit_job_template_items on public.job_template_items;
create trigger trg_audit_job_template_items
  after insert or update or delete on public.job_template_items
  for each row execute function public.gioms_write_audit_log_templates();

-- Chronological listing, actor filtering, and table filtering. The existing
-- (table_name, record_id) and record_key GIN indexes stay for per-record views.
create index if not exists idx_audit_log_changed_at
  on public.audit_log (changed_at desc, audit_id desc);
create index if not exists idx_audit_log_actor
  on public.audit_log (changed_by, changed_at desc);
create index if not exists idx_audit_log_table_time
  on public.audit_log (table_name, changed_at desc);
