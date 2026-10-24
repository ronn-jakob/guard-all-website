
-- All 27 application functions reference only pg_catalog and public objects
-- (verified: no auth/storage/extensions references), so an explicit path is safe
-- and removes the search-path warning.
do $$
declare
  f record;
begin
  for f in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and pg_get_userbyid(p.proowner) = 'postgres'
       and not exists (
         select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
       )
       and (p.proconfig is null or not exists (
         select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%'
       ))
  loop
    execute format(
      'alter function public.%I(%s) set search_path = pg_catalog, public, pg_temp',
      f.proname, f.args
    );
  end loop;
end $$;
;
