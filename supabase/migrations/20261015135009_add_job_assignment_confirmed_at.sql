alter table public.jobs
  add column if not exists assignment_confirmed_at timestamptz;;
