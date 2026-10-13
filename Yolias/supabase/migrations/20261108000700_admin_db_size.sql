-- Database size for the Admin's capacity alert (2026-10-12): the real size
-- Postgres reports, read with the service role only. Read-only.
create or replace function public.admin_db_size()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select pg_database_size(current_database());
$$;
revoke all on function public.admin_db_size() from public, anon, authenticated;
grant execute on function public.admin_db_size() to service_role;
