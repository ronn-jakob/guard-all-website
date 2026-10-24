
alter table public.job_templates
  add column if not exists markup_percent numeric(6,2) not null default 0
  check (markup_percent >= 0);

-- Adding a parameter changes the signature, which would create an overload instead
-- of replacing, so drop the previous 8-argument version first.
drop function if exists public.gioms_save_job_template(uuid, text, public.job_type, public.branch_type, text, boolean, jsonb, uuid);

create function public.gioms_save_job_template(
  p_template_id uuid,
  p_name text,
  p_job_type public.job_type,
  p_branch public.branch_type,
  p_description text,
  p_is_active boolean,
  p_markup_percent numeric,
  p_items jsonb,
  p_actor uuid
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_item jsonb;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'A template name is required.';
  end if;
  if p_job_type is null then
    raise exception 'A service type is required.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one line to the template.';
  end if;
  if coalesce(p_markup_percent, 0) < 0 then
    raise exception 'Markup cannot be negative.';
  end if;

  if p_template_id is null then
    insert into public.job_templates (name, job_type, branch, description, is_active, markup_percent, created_by)
    values (
      btrim(p_name), p_job_type, p_branch,
      nullif(btrim(coalesce(p_description, '')), ''),
      coalesce(p_is_active, true), coalesce(p_markup_percent, 0), p_actor
    )
    returning template_id into v_id;
  else
    update public.job_templates
       set name = btrim(p_name),
           job_type = p_job_type,
           branch = p_branch,
           description = nullif(btrim(coalesce(p_description, '')), ''),
           is_active = coalesce(p_is_active, true),
           markup_percent = coalesce(p_markup_percent, 0)
     where template_id = p_template_id
     returning template_id into v_id;

    if v_id is null then
      raise exception 'Template not found.';
    end if;

    delete from public.job_template_items where template_id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.job_template_items (template_id, line_type, part_id, description, quantity, unit_price)
    values (
      v_id,
      (v_item ->> 'lineType')::public.quotation_line_type,
      nullif(v_item ->> 'partId', '')::uuid,
      btrim(coalesce(v_item ->> 'description', '')),
      coalesce((v_item ->> 'quantity')::numeric, 1),
      coalesce((v_item ->> 'unitPrice')::numeric, 0)
    );
  end loop;

  return v_id;
end;
$$;
;
