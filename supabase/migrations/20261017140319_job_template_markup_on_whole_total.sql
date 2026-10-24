
-- Template lines now store BASE prices; the markup is applied when the quote is
-- generated, so each quotation line carries the final client price and the quote
-- total (sum of its lines) is correct by construction.
create or replace function public.gioms_create_job_from_template(
  p_client_id uuid,
  p_first_name text,
  p_last_name text,
  p_client_type text,
  p_company_name text,
  p_email text,
  p_phone text,
  p_site_address text,
  p_template_id uuid,
  p_accepted_by_name text,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_branch public.branch_type,
  p_technician_ids uuid[],
  p_actor uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_client_id uuid;
  v_client_type public.client_type;
  v_template record;
  v_factor numeric;
  v_quotation_id uuid;
  v_quotation_number text;
  v_job_id uuid;
  v_job_number text;
  v_item record;
  v_technician uuid;
  v_distinct int;
  v_valid int;
begin
  if p_template_id is null then
    raise exception 'Choose a job template.';
  end if;

  select * into v_template from public.job_templates where template_id = p_template_id;
  if not found then
    raise exception 'Template not found.';
  end if;
  if not v_template.is_active then
    raise exception 'This template is no longer available.';
  end if;
  if p_branch is null then
    raise exception 'Choose a branch.';
  end if;
  if v_template.branch is not null and v_template.branch <> p_branch then
    raise exception 'This template is only available for the % branch.', v_template.branch;
  end if;
  if p_date is null or p_start_time is null or p_end_time is null then
    raise exception 'Provide a date and a start and end time.';
  end if;
  if (p_date + p_end_time) <= (p_date + p_start_time) then
    raise exception 'The end time must be after the start time.';
  end if;
  if p_accepted_by_name is null or btrim(p_accepted_by_name) = '' then
    raise exception 'Record who accepted the quotation.';
  end if;
  if p_site_address is null or btrim(p_site_address) = '' then
    raise exception 'A site address is required.';
  end if;
  if not exists (select 1 from public.job_template_items where template_id = p_template_id) then
    raise exception 'This template has no lines.';
  end if;

  v_factor := 1 + coalesce(v_template.markup_percent, 0) / 100;

  if p_client_id is not null then
    select client_id into v_client_id from public.clients where client_id = p_client_id;
    if v_client_id is null then
      raise exception 'Client not found.';
    end if;
  else
    v_client_type := coalesce(nullif(btrim(coalesce(p_client_type, '')), ''), 'individual')::public.client_type;

    if v_client_type = 'company' and coalesce(btrim(p_company_name), '') = '' then
      raise exception 'A company name is required.';
    end if;
    if v_client_type = 'individual'
       and (coalesce(btrim(p_first_name), '') = '' or coalesce(btrim(p_last_name), '') = '') then
      raise exception 'First and last name are required.';
    end if;

    insert into public.clients (
      first_name, last_name, company_name, name, client_type, contact_channel,
      branch_served, phone, email, address
    ) values (
      nullif(btrim(coalesce(p_first_name, '')), ''),
      nullif(btrim(coalesce(p_last_name, '')), ''),
      case when v_client_type = 'company' then nullif(btrim(coalesce(p_company_name, '')), '') else null end,
      case when v_client_type = 'company'
           then nullif(btrim(coalesce(p_company_name, '')), '')
           else nullif(btrim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')), '')
      end,
      v_client_type,
      'website',
      p_branch,
      nullif(btrim(coalesce(p_phone, '')), ''),
      nullif(btrim(coalesce(p_email, '')), ''),
      btrim(p_site_address)
    ) returning client_id into v_client_id;
  end if;

  insert into public.quotations (
    client_id, branch, job_type, site_address, status, total_amount, prepared_by, template_id
  ) values (
    v_client_id, p_branch, v_template.job_type, btrim(p_site_address), 'draft', 0, p_actor, p_template_id
  ) returning quotation_id, quotation_number into v_quotation_id, v_quotation_number;

  -- Apply the template markup to each line's base price, rounded per line so the
  -- stored quote total always equals what was shown to the client.
  for v_item in
    select line_type, part_id, description, quantity, unit_price
      from public.job_template_items
     where template_id = p_template_id
     order by item_id
  loop
    insert into public.quotation_line_items (quotation_id, line_type, part_id, description, quantity, unit_price)
    values (
      v_quotation_id, v_item.line_type, v_item.part_id, v_item.description, v_item.quantity,
      round(v_item.unit_price * v_factor, 2)
    );
  end loop;

  update public.quotations set status = 'sent' where quotation_id = v_quotation_id;
  update public.quotations
     set status = 'accepted', accepted_by_name = btrim(p_accepted_by_name)
   where quotation_id = v_quotation_id;

  insert into public.jobs (
    client_id, job_type, status, branch, scheduled_date, scheduled_time,
    scheduled_end_date, scheduled_end_time, created_by, quotation_id, site_address
  ) values (
    v_client_id, v_template.job_type, 'scheduled', p_branch, p_date, p_start_time,
    p_date, p_end_time, p_actor, v_quotation_id, btrim(p_site_address)
  ) returning job_id, job_number into v_job_id, v_job_number;

  if p_technician_ids is not null and array_length(p_technician_ids, 1) > 0 then
    select count(distinct x) into v_distinct from unnest(p_technician_ids) as x;
    select count(*) into v_valid
      from public.technicians t
      join public.users u on u.user_id = t.user_id
      join public.roles r on r.role_id = u.role_id
     where t.technician_id = any(p_technician_ids)
       and u.is_active
       and r.role_name = 'Technician';

    if v_valid <> v_distinct then
      raise exception 'Only active users with the Technician role can be assigned.';
    end if;

    foreach v_technician in array p_technician_ids loop
      insert into public.job_technicians (job_id, technician_id, is_active)
      values (v_job_id, v_technician, true);
    end loop;
  end if;

  return jsonb_build_object(
    'jobId', v_job_id,
    'jobNumber', v_job_number,
    'quotationId', v_quotation_id,
    'quotationNumber', v_quotation_number
  );
end;
$$;
;
