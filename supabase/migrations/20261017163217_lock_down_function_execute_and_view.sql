
-- Every application function is called by guard-auth/guard-account with the
-- service-role key, so nothing outside the Edge Functions needs EXECUTE.
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
  loop
    execute format(
      'revoke execute on function public.%I(%s) from public, anon, authenticated',
      f.proname, f.args
    );
    execute format(
      'grant execute on function public.%I(%s) to service_role',
      f.proname, f.args
    );
  end loop;
end $$;

-- New functions created by the migration role must not inherit public access
-- either; the four billing/template RPCs were exposed precisely this way.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

-- The view ran with the owner's rights, so anon could read jobs and client names
-- past RLS. Run it as the caller and close it to anonymous traffic.
alter view public.warehouse_queue set (security_invoker = true);
revoke all on public.warehouse_queue from public, anon, authenticated;
;
