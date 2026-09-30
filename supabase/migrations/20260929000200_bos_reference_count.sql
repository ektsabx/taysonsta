-- Counts rows referencing a record through any single-column FK, including
-- ON DELETE SET NULL / CASCADE ones — Settings uses it to deactivate instead of
-- deleting records that history depends on (docs/bos/22 edge cases).
create or replace function public.bos_reference_count(p_table text, p_id text)
returns integer
language plpgsql
stable
as $$
declare
  r record;
  v_total integer := 0;
  v_n integer;
begin
  for r in
    select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.confrelid = ('public.' || p_table)::regclass and c.contype = 'f' and array_length(c.conkey, 1) = 1
  loop
    execute format('select count(*) from %s where %I::text = $1', r.tbl, r.col) into v_n using p_id;
    v_total := v_total + v_n;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.bos_reference_count(text, text) from public, anon, authenticated;
grant execute on function public.bos_reference_count(text, text) to service_role;
