-- Job-template audit lines were keyed on a column that does not exist.
--
-- gioms_write_audit_log_templates() read `chosen_row ->> 'template_item_id'`
-- for job_template_items, whose primary key is `item_id`. The expression
-- evaluated to NULL, so the audit INSERT violated audit_log.record_id
-- (NOT NULL) and every insert/update/delete on a template line aborted its
-- transaction. Since gioms_save_job_template always writes its lines, creating,
-- editing, and deleting templates all failed.
--
-- The rest of the trigger body is copied from the live 2026-10-23 revision
-- (audit_update_old_values.sql), which snapshots OLD for updates; only the key
-- mapping changes here.

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

  if tg_op <> 'INSERT' then old_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_row := to_jsonb(new); end if;
  chosen_row := coalesce(new_row, old_row);

  case tg_table_name
    when 'job_templates' then
      chosen_id := (chosen_row ->> 'template_id')::uuid;
      chosen_key := jsonb_build_object('template_id', chosen_id);
    when 'job_template_items' then
      chosen_id := (chosen_row ->> 'item_id')::uuid;
      chosen_key := jsonb_build_object(
        'item_id', chosen_id,
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
