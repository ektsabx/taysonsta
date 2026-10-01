-- Aggregates for Yolias Admin (docs/09-yolias-admin.md). Read by the admin
-- server with the service role only; customers can't call it.

create or replace function public.admin_workspace_stats(month_start timestamptz)
returns table (
  workspace_id uuid,
  members int,
  searches int,
  campaigns int,
  prospects_total int,
  prospects_month int,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id,
    (select count(*) from workspace_members m where m.workspace_id = w.id)::int,
    (select count(*) from strategies s where s.workspace_id = w.id)::int,
    (select count(*) from campaigns c where c.workspace_id = w.id)::int,
    (select count(*) from prospects p where p.workspace_id = w.id)::int,
    (select count(*) from prospects p where p.workspace_id = w.id and p.created_at >= month_start)::int,
    greatest(w.updated_at, (select max(s.created_at) from strategies s where s.workspace_id = w.id))
  from workspaces w;
$$;

revoke all on function public.admin_workspace_stats(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_workspace_stats(timestamptz) to service_role;
