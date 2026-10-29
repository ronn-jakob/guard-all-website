-- Jobs whose quotation has no part lines never need stock allocation.
--
-- The parts_status enum already has 'not_required', and the UI/stage logic
-- treats it as allocated, but nothing ever set it: a labour-only job stayed
-- 'pending' and sat in Pending Job Requests forever. Confirming the assignment
-- now classifies such a job as not_required, and the existing
-- enforce_job_parts_status trigger validates the transition (no reserved parts,
-- confirmer supplied) and stamps parts_confirmed_at.

do $migration$
declare
  definition text;
  declare_anchor text := '  v_new_number text;';
  declare_replacement text := E'  v_new_number text;\n  v_no_parts boolean := false;';
  insert_anchor text := '  v_new_number := v_job.job_number;';
  insert_replacement text := E'  if v_job.quotation_id is not null then\n    select not exists (\n      select 1 from public.quotation_line_items q\n      where q.quotation_id = v_job.quotation_id and q.line_type = ''parts''\n    ) into v_no_parts;\n  end if;\n\n  v_new_number := v_job.job_number;';
  update_anchor text := $u$  update public.jobs
     set job_number = v_new_number,
         assignment_confirmed_at = v_confirmed_at
   where job_id = v_job.job_id;$u$;
  update_replacement text := $u$  update public.jobs
     set job_number = v_new_number,
         assignment_confirmed_at = v_confirmed_at,
         parts_status = case when v_no_parts then 'not_required'::public.parts_status
                             else v_job.parts_status end,
         parts_confirmed_by = case when v_no_parts then p_actor
                                   else v_job.parts_confirmed_by end
   where job_id = v_job.job_id;$u$;
begin
  select pg_get_functiondef(p.oid)
    into definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'gioms_confirm_job_assignment';

  if definition is null then
    raise exception 'gioms_confirm_job_assignment() not found';
  end if;
  if position(declare_anchor in definition) = 0 then
    raise exception 'declare anchor missing from gioms_confirm_job_assignment()';
  end if;
  if position(insert_anchor in definition) = 0 then
    raise exception 'insert anchor missing from gioms_confirm_job_assignment()';
  end if;
  if position(update_anchor in definition) = 0 then
    raise exception 'update anchor missing from gioms_confirm_job_assignment()';
  end if;

  definition := replace(definition, declare_anchor, declare_replacement);
  definition := replace(definition, insert_anchor, insert_replacement);
  definition := replace(definition, update_anchor, update_replacement);
  execute definition;
end
$migration$;

revoke all on function public.gioms_confirm_job_assignment(text, uuid) from public;
revoke all on function public.gioms_confirm_job_assignment(text, uuid) from anon;
revoke all on function public.gioms_confirm_job_assignment(text, uuid) from authenticated;
grant execute on function public.gioms_confirm_job_assignment(text, uuid) to service_role;

-- Backfill: confirmed, still-pending jobs with a quotation that has no part
-- lines and nothing reserved. Strictly limited so a partially reserved job is
-- never reclassified.
update public.jobs j
   set parts_status = 'not_required',
       parts_confirmed_by = j.created_by
 where j.parts_status = 'pending'
   and j.status = 'scheduled'
   and j.assignment_confirmed_at is not null
   and j.quotation_id is not null
   and not exists (
     select 1
       from public.quotation_line_items q
      where q.quotation_id = j.quotation_id
        and q.line_type = 'parts'
   )
   and not exists (
     select 1
       from public.job_parts jp
      where jp.job_id = j.job_id
        and jp.status = 'reserved'
   );
