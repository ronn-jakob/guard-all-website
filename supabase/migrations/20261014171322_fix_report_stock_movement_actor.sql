CREATE OR REPLACE FUNCTION public.gioms_submit_field_report(
  p_job_id uuid,
  p_technician_id uuid,
  p_work_performed text,
  p_issue_description text,
  p_recommendations text,
  p_site_address text,
  p_service_date date,
  p_time_arrival time,
  p_client_signoff boolean,
  p_client_signoff_name text,
  p_additional_notes text,
  p_attachments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_report public.field_reports%ROWTYPE;
  v_reservation public.job_parts%ROWTYPE;
  v_movement_id uuid;
BEGIN
  IF p_job_id IS NULL OR p_technician_id IS NULL
     OR NULLIF(btrim(COALESCE(p_work_performed, '')), '') IS NULL
     OR p_service_date IS NULL THEN
    RAISE EXCEPTION 'Please complete the required report fields before submitting.';
  END IF;
  IF p_attachments IS NOT NULL AND jsonb_typeof(p_attachments) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Report attachments must be a list.';
  END IF;

  SELECT j.*
    INTO v_job
    FROM public.jobs AS j
   WHERE j.job_id = p_job_id
   FOR UPDATE;

  IF NOT FOUND OR v_job.status = 'cancelled' THEN
    RAISE EXCEPTION 'The assigned job is unavailable for reporting.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.job_technicians AS jt
     WHERE jt.job_id = p_job_id
       AND jt.technician_id = p_technician_id
       AND jt.is_active
  ) THEN
    RAISE EXCEPTION 'The technician is not assigned to this job.';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.field_reports AS fr
     WHERE fr.job_id = p_job_id
       AND fr.technician_id = p_technician_id
  ) THEN
    RAISE EXCEPTION 'A field report has already been submitted for this job.';
  END IF;

  INSERT INTO public.field_reports (
    job_id,
    technician_id,
    work_performed,
    issue_description,
    recommendations,
    site_address,
    service_date,
    time_arrival,
    client_signoff,
    client_signoff_name,
    additional_notes,
    review_status,
    submitted_at
  )
  VALUES (
    p_job_id,
    p_technician_id,
    btrim(p_work_performed),
    NULLIF(btrim(COALESCE(p_issue_description, '')), ''),
    NULLIF(btrim(COALESCE(p_recommendations, '')), ''),
    NULLIF(btrim(COALESCE(p_site_address, '')), ''),
    p_service_date,
    p_time_arrival,
    COALESCE(p_client_signoff, false),
    NULLIF(btrim(COALESCE(p_client_signoff_name, '')), ''),
    NULLIF(btrim(COALESCE(p_additional_notes, '')), ''),
    'submitted',
    now()
  )
  RETURNING * INTO v_report;

  IF p_attachments IS NOT NULL THEN
    INSERT INTO public.report_attachments (report_id, file_type, file_url)
    SELECT v_report.report_id, 'photo', NULLIF(btrim(attachment->>'fileUrl'), '')
      FROM jsonb_array_elements(p_attachments) AS attachment
     WHERE NULLIF(btrim(attachment->>'fileUrl'), '') IS NOT NULL;
  END IF;

  FOR v_reservation IN
    SELECT jp.*
      FROM public.job_parts AS jp
     WHERE jp.job_id = p_job_id
       AND jp.status = 'reserved'
     ORDER BY jp.job_part_id
     FOR UPDATE
  LOOP
    UPDATE public.job_parts
       SET status = 'consumed'
     WHERE job_part_id = v_reservation.job_part_id;

    INSERT INTO public.stock_movements (
      part_id,
      branch,
      direction,
      quantity,
      reason,
      related_job_id,
      related_job_part_id,
      performed_by
    )
    VALUES (
      v_reservation.part_id,
      v_job.branch,
      'out',
      v_reservation.quantity,
      'job_usage',
      p_job_id,
      v_reservation.job_part_id,
      v_reservation.reserved_by
    )
    RETURNING movement_id INTO v_movement_id;

    INSERT INTO public.report_parts_used (
      report_id,
      part_id,
      quantity,
      stock_movement_id
    )
    VALUES (
      v_report.report_id,
      v_reservation.part_id,
      v_reservation.quantity,
      v_movement_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'reportId', v_report.report_id,
    'reportNumber', v_report.report_number
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.gioms_submit_field_report(uuid, uuid, text, text, text, text, date, time, boolean, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gioms_submit_field_report(uuid, uuid, text, text, text, text, date, time, boolean, text, text, jsonb) TO service_role;;
