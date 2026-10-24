
-- Private bucket for field-report photos. Uploads and downloads are granted only
-- through short-lived signed URLs minted by the Edge Function with the service
-- role, so no storage policies are needed and the bucket stays unreadable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-attachments',
  'report-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
;
