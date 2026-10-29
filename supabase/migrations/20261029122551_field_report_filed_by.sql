-- Admin on-behalf reporting: record who actually filed a report when the acting
-- user is not the technician it belongs to.
--
-- NULL means the technician filed it themselves, which is true for every row
-- written before this column existed, so no backfill is needed. The column is
-- nullable with no default, so adding it is a metadata-only change.

alter table public.field_reports
  add column if not exists filed_by_user_id uuid references public.users(user_id);

comment on column public.field_reports.filed_by_user_id is
  'Acting user when an Admin files a report on a technician''s behalf; NULL when the technician filed it themselves.';
