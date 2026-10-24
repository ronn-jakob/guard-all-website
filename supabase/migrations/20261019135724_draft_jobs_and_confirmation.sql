
-- A draft job may hold its quotation while that quotation is still draft/sent.
-- Once the assignment is confirmed the quotation must be accepted.
create or replace function public.check_job_quotation()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
DECLARE
    q RECORD;
BEGIN
    IF NEW.quotation_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT status, client_id, branch, job_type
      INTO q
      FROM quotations
     WHERE quotation_id = NEW.quotation_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quotation % does not exist.', NEW.quotation_id;
    END IF;
    IF q.status <> 'accepted'
       AND NOT (NEW.assignment_confirmed_at IS NULL AND q.status IN ('draft', 'sent')) THEN
        RAISE EXCEPTION 'Only an accepted quotation can be linked to a confirmed job (this one is %).', q.status;
    END IF;
    IF q.client_id <> NEW.client_id THEN
        RAISE EXCEPTION 'The quotation belongs to a different client than this job.';
    END IF;
    IF q.branch <> NEW.branch THEN
        RAISE EXCEPTION 'The quotation branch must match the job branch.';
    END IF;
    IF q.job_type <> NEW.job_type THEN
        RAISE EXCEPTION 'The quotation service type must match the job type.';
    END IF;
    RETURN NEW;
END;
$$;

-- Creating a job now produces a draft: the quotation stays in draft (so its lines
-- and identity remain editable), the job is unconfirmed, and the work-order number
-- is a placeholder so drafts never consume the WO- sequence.
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

  insert into public.jobs (
    client_id, job_type, status, branch, scheduled_date, scheduled_time,
    scheduled_end_date, scheduled_end_time, created_by, quotation_id, site_address,
    job_number
  ) values (
    v_client_id, v_template.job_type, 'scheduled', p_branch, p_date, p_start_time,
    p_date, p_end_time, p_actor, v_quotation_id, btrim(p_site_address),
    'DRAFT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
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
    'quotationNumber', v_quotation_number,
    'isDraft', true
  );
end;
$$;

-- Confirmation is the moment the draft becomes official: the quotation is accepted
-- (recorded against the person who prepared it, not the confirmer) and the real
-- work-order number is issued.
create or replace function public.gioms_confirm_job_assignment(
  p_job_number text,
  p_actor uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job record;
  v_quote record;
  v_name text;
  v_confirmed_at timestamptz := now();
  v_new_number text;
begin
  select * into v_job
    from public.jobs
   where job_number = btrim(coalesce(p_job_number, ''))
   for update;

  if not found then
    raise exception 'Scheduled job not found.';
  end if;
  if v_job.status = 'cancelled' then
    raise exception 'Cancelled jobs cannot be confirmed.';
  end if;
  if v_job.assignment_confirmed_at is not null then
    return jsonb_build_object(
      'jobNumber', v_job.job_number,
      'confirmedAt', v_job.assignment_confirmed_at,
      'alreadyConfirmed', true
    );
  end if;
  if v_job.parts_status <> 'pending' then
    raise exception 'This job''s stock has already been allocated.';
  end if;

  if v_job.quotation_id is not null then
    select * into v_quote
      from public.quotations
     where quotation_id = v_job.quotation_id
     for update;

    if not found then
      raise exception 'The quotation for this job no longer exists.';
    end if;
    if v_quote.status in ('rejected', 'expired') then
      raise exception 'This quotation is % and cannot be accepted.', v_quote.status;
    end if;

    if v_quote.status = 'draft' then
      update public.quotations set status = 'sent' where quotation_id = v_quote.quotation_id;
    end if;

    if v_quote.status <> 'accepted' then
      -- The representative is the person who prepared the quote (the Service
      -- Manager who agreed it), falling back to the confirming user.
      select nullif(btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
        into v_name
        from public.users u
       where u.user_id = v_quote.prepared_by;

      if v_name is null then
        select nullif(btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
          into v_name
          from public.users u
         where u.user_id = p_actor;
      end if;

      update public.quotations
         set status = 'accepted',
             accepted_by_name = coalesce(v_name, 'Guard-All representative')
       where quotation_id = v_quote.quotation_id;
    end if;
  end if;

  v_new_number := v_job.job_number;
  if v_new_number like 'DRAFT-%' then
    v_new_number := public.gioms_format_number('WO-', nextval('public.job_number_seq'));
  end if;

  update public.jobs
     set job_number = v_new_number,
         assignment_confirmed_at = v_confirmed_at
   where job_id = v_job.job_id;

  return jsonb_build_object(
    'jobNumber', v_new_number,
    'confirmedAt', v_confirmed_at,
    'quotationNumber',
      (select quotation_number from public.quotations where quotation_id = v_job.quotation_id),
    'alreadyConfirmed', false
  );
end;
$$;
;
