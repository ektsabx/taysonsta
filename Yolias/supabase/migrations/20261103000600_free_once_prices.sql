-- Owner decisions (2026-10-06, D-138):
-- 1) Growth costs $100 a month (Pro stays $20).
-- 2) The Free plan's prospects are a one-time gift at signup, not a monthly
--    allowance: on Free, this month's quota is what's left of the plan's
--    number after everything the workspace consumed in earlier months.
update public.plan_quotas set price_usd = 100, updated_by = 'owner decision D-138', updated_at = now() where plan = 'growth';

create or replace function public.usage_summary(p_ws uuid)
returns table (period_start date, quota int, granted int, allowance int, consumed int, reserved int, available int)
language sql
stable
security definer
set search_path = public
as $$
  with p as (select public.usage_period_start() as ps),
  q as (
    select case when w.plan = 'free'
      -- One-time: the signup gift minus what was used before this month.
      then greatest(coalesce(pq.prospects_per_month, 0) - (
        select coalesce(sum(u.prospects), 0)::int from public.usage_ledger u, p
        where u.workspace_id = p_ws and u.kind = 'consume' and u.period_start < p.ps
      ), 0)
      else coalesce(pq.prospects_per_month, 0) end as quota
    from public.workspaces w left join public.plan_quotas pq on pq.plan = w.plan
    where w.id = p_ws
  ),
  l as (
    select
      coalesce(sum(prospects) filter (where kind in ('grant', 'adjust')), 0)::int as granted,
      coalesce(sum(prospects) filter (where kind = 'consume'), 0)::int as consumed
    from public.usage_ledger, p
    where workspace_id = p_ws and usage_ledger.period_start = p.ps
  ),
  -- Held per campaign (never negative: delivered-before-the-ledger rows have no reservation).
  r as (
    select coalesce(sum(greatest(held, 0)), 0)::int as reserved
    from (
      select sum(case kind when 'reserve' then prospects when 'consume' then -prospects when 'release' then -prospects else 0 end) as held
      from public.usage_ledger, p
      where workspace_id = p_ws and usage_ledger.period_start = p.ps and campaign_id is not null
      group by campaign_id
    ) x
  )
  select p.ps, q.quota, l.granted, q.quota + l.granted, l.consumed, r.reserved,
         greatest(q.quota + l.granted - l.consumed - r.reserved, 0)
  from p, q, l, r;
$$;
