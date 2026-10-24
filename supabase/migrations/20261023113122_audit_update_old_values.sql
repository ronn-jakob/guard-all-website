do $migration$
declare
  function_name text;
  definition text;
  rewritten text;
  pattern text := 'IF\s+TG_OP\s*=\s*''DELETE''\s+THEN\s+old_row\s*:=\s*to_jsonb\(OLD\);\s+chosen_row\s*:=\s*old_row;\s+ELSE\s+new_row\s*:=\s*to_jsonb\(NEW\);\s+chosen_row\s*:=\s*new_row;\s+END\s+IF;';
  replacement text := 'IF TG_OP <> ''INSERT'' THEN old_row := to_jsonb(OLD); END IF; IF TG_OP <> ''DELETE'' THEN new_row := to_jsonb(NEW); END IF; chosen_row := COALESCE(new_row, old_row);';
begin
  foreach function_name in array array[
    'gioms_write_audit_log',
    'gioms_write_audit_log_migration002',
    'gioms_write_audit_log_templates',
    'gioms_write_audit_log_categories'
  ] loop
    select pg_get_functiondef(p.oid)
      into definition
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = function_name;

    if definition is null then
      raise exception 'Audit trigger function % not found', function_name;
    end if;

    rewritten := regexp_replace(definition, pattern, replacement, 'is');
    if rewritten = definition then
      raise exception 'Audit trigger function % does not match the expected block', function_name;
    end if;

    execute rewritten;
  end loop;
end
$migration$;;
