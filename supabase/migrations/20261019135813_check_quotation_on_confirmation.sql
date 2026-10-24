
-- Confirming a job writes assignment_confirmed_at, so the quotation guard must run
-- for that column too; otherwise a draft quote could be confirmed in place.
drop trigger if exists trg_jobs_check_quotation on public.jobs;
create trigger trg_jobs_check_quotation
  before insert or update of quotation_id, client_id, branch, job_type, assignment_confirmed_at
  on public.jobs
  for each row execute function public.check_job_quotation();
;
