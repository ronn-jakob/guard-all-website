alter table public.users
  add column first_name text,
  add column last_name text;

update public.users
set
  first_name = case
    when position(' ' in trim(full_name)) > 0 then left(trim(full_name), position(' ' in trim(full_name)) - 1)
    else trim(full_name)
  end,
  last_name = case
    when position(' ' in trim(full_name)) > 0 then trim(substring(trim(full_name) from position(' ' in trim(full_name)) + 1))
    else ''
  end;

alter table public.users
  alter column first_name set not null,
  alter column last_name set not null;

alter table public.users drop column full_name;;
