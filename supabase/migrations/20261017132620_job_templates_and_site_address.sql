
create table if not exists public.job_templates (
  template_id uuid primary key default gen_random_uuid(),
  name text not null,
  job_type public.job_type not null,
  branch public.branch_type,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_job_templates_name
  on public.job_templates (name);
create index if not exists idx_job_templates_lookup
  on public.job_templates (job_type, branch, is_active);

create table if not exists public.job_template_items (
  item_id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.job_templates(template_id) on delete cascade,
  line_type public.quotation_line_type not null,
  part_id uuid references public.parts(part_id),
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) generated always as (quantity * unit_price) stored,
  constraint job_template_items_quantity_check check (quantity > 0),
  constraint job_template_items_unit_price_check check (unit_price >= 0),
  constraint chk_template_item_part_matches_type check (
    (line_type = 'parts' and part_id is not null)
    or (line_type <> 'parts' and part_id is null)
  )
);

create index if not exists idx_job_template_items_template
  on public.job_template_items (template_id);

create or replace trigger trg_job_templates_updated_at
  before update on public.job_templates
  for each row execute function public.gioms_set_updated_at();

alter table public.jobs        add column if not exists site_address text;
alter table public.quotations  add column if not exists template_id uuid
  references public.job_templates(template_id);
alter table public.invoices    add column if not exists quotation_id uuid
  references public.quotations(quotation_id);

alter table public.job_templates      enable row level security;
alter table public.job_template_items enable row level security;
;
