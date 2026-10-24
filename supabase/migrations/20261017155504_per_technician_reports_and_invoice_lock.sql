
-- One report per technician per job: the collection model. The application already
-- checked this pair, but nothing enforced it at the data layer.
create unique index if not exists uq_field_reports_job_technician
  on public.field_reports (job_id, technician_id);

-- Serialize invoice creation per job so two concurrent clicks cannot both pass
-- the "already invoiced" check and create duplicate invoices.
create or replace function public.gioms_create_invoice_from_report(
  p_report_id uuid,
  p_due_date date,
  p_extra_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report record;
  v_job record;
  v_invoice_id uuid;
  v_invoice_number text;
  v_total numeric(12,2);
  v_extra record;
  v_extra_count int := 0;
begin
  select * into v_report from public.field_reports where report_id = p_report_id;
  if not found then
    raise exception 'Field report not found.';
  end if;
  if v_report.review_status <> 'approved' then
    raise exception 'Only approved field reports can be invoiced.';
  end if;

  select * into v_job
    from public.jobs
   where job_id = v_report.job_id
   for update;

  if not found then
    raise exception 'The job for this report no longer exists.';
  end if;

  if exists (
    select 1 from public.invoices
     where job_id = v_job.job_id and status <> 'cancelled'
  ) then
    raise exception 'This job has already been invoiced.';
  end if;

  if p_due_date is not null and p_due_date < current_date then
    raise exception 'The due date cannot be before the issue date.';
  end if;

  insert into public.invoices (
    job_id, report_id, client_id, quotation_id, total_amount, status, issue_date, due_date
  ) values (
    v_job.job_id, p_report_id, v_job.client_id, v_job.quotation_id, 0, 'pending', current_date, p_due_date
  ) returning invoice_id, invoice_number into v_invoice_id, v_invoice_number;

  if v_job.quotation_id is not null then
    insert into public.invoice_line_items (invoice_id, description, quantity, unit_price)
    select v_invoice_id, li.description, li.quantity, li.unit_price
      from public.quotation_line_items li
     where li.quotation_id = v_job.quotation_id
     order by li.line_item_id;
  end if;

  if p_extra_lines is not null and jsonb_typeof(p_extra_lines) = 'array' then
    for v_extra in
      select * from jsonb_to_recordset(p_extra_lines)
        as x(description text, quantity numeric, unit_price numeric)
    loop
      v_extra_count := v_extra_count + 1;
      if v_extra_count > 25 then
        raise exception 'Add at most 25 extra lines.';
      end if;
      if v_extra.description is null or btrim(v_extra.description) = '' then
        raise exception 'Every extra line needs a description.';
      end if;
      if v_extra.quantity is null or v_extra.quantity <= 0 then
        raise exception 'Extra line quantities must be greater than zero.';
      end if;
      if v_extra.unit_price is null or v_extra.unit_price < 0 then
        raise exception 'Extra line prices cannot be negative.';
      end if;

      insert into public.invoice_line_items (invoice_id, description, quantity, unit_price)
      values (v_invoice_id, btrim(v_extra.description), v_extra.quantity, v_extra.unit_price);
    end loop;
  end if;

  select coalesce(sum(line_total), 0) into v_total
    from public.invoice_line_items
   where invoice_id = v_invoice_id;

  if v_total <= 0 then
    raise exception 'The invoice needs at least one priced line.';
  end if;

  update public.invoices set total_amount = v_total where invoice_id = v_invoice_id;

  return jsonb_build_object(
    'invoiceId', v_invoice_id,
    'invoiceNumber', v_invoice_number,
    'totalAmount', v_total
  );
end;
$$;
;
