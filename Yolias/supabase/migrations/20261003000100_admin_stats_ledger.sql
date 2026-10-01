-- Admin workspace stats read usage from the ledger (docs/06): used = consumed
-- this month, allowance = plan quota + grants/adjustments.
drop function if exists public.admin_workspace_stats(timestamptz);

create or replace function public.admin_workspace_stats(month_start timestamptz)
returns table (
  workspace_id uuid,
  members int,
  searches int,
  campaigns int,
  prospects_total int,
  prospects_month int,
  allowance int,
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
    (select coalesce(sum(l.prospects), 0) from usage_ledger l
      where l.workspace_id = w.id and l.kind = 'consume' and l.period_start = usage_period_start(month_start))::int,
    (coalesce((select q.prospects_per_month from plan_quotas q where q.plan = w.plan), 0)
      + (select coalesce(sum(l.prospects), 0) from usage_ledger l
          where l.workspace_id = w.id and l.kind in ('grant', 'adjust') and l.period_start = usage_period_start(month_start)))::int,
    greatest(w.updated_at, (select max(s.created_at) from strategies s where s.workspace_id = w.id))
  from workspaces w;
$$;

revoke all on function public.admin_workspace_stats(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_workspace_stats(timestamptz) to service_role;
