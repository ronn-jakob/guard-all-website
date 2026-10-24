
alter table public.users
  add column if not exists phone text,
  add column if not exists title text;

create table if not exists public.password_reset_requests (
  request_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  email text not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  handled_by uuid references public.users(user_id),
  handled_at timestamptz,
  constraint password_reset_requests_status_check
    check (status in ('pending', 'approved', 'cancelled'))
);

create unique index if not exists uq_password_reset_pending_per_user
  on public.password_reset_requests (user_id) where status = 'pending';

create index if not exists idx_password_reset_status
  on public.password_reset_requests (status, requested_at desc);

alter table public.password_reset_requests enable row level security;
;
