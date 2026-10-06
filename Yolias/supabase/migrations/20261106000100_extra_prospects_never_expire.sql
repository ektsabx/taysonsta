-- Owner decision (2026-10-06, D-145): bought prospects (Buy more prospects)
-- don't expire at the end of the month — they last until they're used.
-- The plan's prospects are used first; once they're gone, deliveries draw
-- from the bought balance (consume rows with reason 'extra').
--
--   packs      = every pack grant ever (reason 'prospect_pack:%')
--   extra_left = packs − every 'extra' consume ever
--   base       = plan quota + this month's other grants / adjustments
--   base_used  = this month's consumes that weren't 'extra'
--   available  = max(base − base_used, 0) + extra_left − reserved

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
      -- One-time (D-138): the signup gift minus what the plan covered before this month.
      then greatest(coalesce(pq.prospects_per_month, 0) - (
        select coalesce(sum(u.prospects), 0)::int from public.usage_ledger u, p
        where u.workspace_id = p_ws and u.kind = 'consume' and coalesce(u.reason, '') <> 'extra' and u.period_start < p.ps
      ), 0)
      else coalesce(pq.prospects_per_month, 0) end as quota
    from public.workspaces w left join public.plan_quotas pq on pq.plan = w.plan
    where w.id = p_ws
  ),
  l as (
    select
      coalesce(sum(prospects) filter (where kind in ('grant', 'adjust') and coalesce(reason, '') not like 'prospect_pack:%'), 0)::int as other_grants,
      coalesce(sum(prospects) filter (where kind = 'consume'), 0)::int as consumed,
      coalesce(sum(prospects) filter (where kind = 'consume' and coalesce(reason, '') <> 'extra'), 0)::int as base_used,
      coalesce(sum(prospects) filter (where kind = 'consume' and reason = 'extra'), 0)::int as extra_used_now
    from public.usage_ledger, p
    where workspace_id = p_ws and usage_ledger.period_start = p.ps
  ),
  x as (
    select greatest(
      coalesce(sum(prospects) filter (where kind = 'grant' and reason like 'prospect_pack:%'), 0)
      - coalesce(sum(prospects) filter (where kind = 'consume' and reason = 'extra'), 0), 0)::int as extra_left
    from public.usage_ledger where workspace_id = p_ws
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
  select p.ps,
         q.quota,
         l.other_grants + l.extra_used_now + x.extra_left,
         q.quota + l.other_grants + l.extra_used_now + x.extra_left,
         l.consumed,
         r.reserved,
         greatest(greatest(q.quota + l.other_grants - l.base_used, 0) + x.extra_left - r.reserved, 0)
  from p, q, l, x, r;
$$;

-- A delivery uses the plan's prospects first, then the bought ones ('extra').
create or replace function public.consume_usage(p_ws uuid, p_campaign uuid, p_n int default 1)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date;
  v_left int;
  v_n int;
  v_base_left int;
  v_from_base int;
begin
  perform pg_advisory_xact_lock(hashtextextended('usage:' || p_ws::text, 0));
  select period_start, outstanding into v_period, v_left from public.usage_outstanding(p_campaign);
  v_n := least(greatest(p_n, 0), coalesce(v_left, 0));
  if v_n > 0 then
    select greatest(s.quota + (
             select coalesce(sum(u.prospects), 0)::int from public.usage_ledger u
             where u.workspace_id = p_ws and u.period_start = v_period and u.kind in ('grant', 'adjust') and coalesce(u.reason, '') not like 'prospect_pack:%')
           - (select coalesce(sum(u.prospects), 0)::int from public.usage_ledger u
              where u.workspace_id = p_ws and u.period_start = v_period and u.kind = 'consume' and coalesce(u.reason, '') <> 'extra'), 0)
      into v_base_left
    from public.usage_summary(p_ws) s;
    v_from_base := least(v_n, coalesce(v_base_left, 0));
    if v_from_base > 0 then
      insert into public.usage_ledger (workspace_id, campaign_id, kind, prospects, period_start, reason)
      values (p_ws, p_campaign, 'consume', v_from_base, v_period, 'prospect delivered');
    end if;
    if v_n - v_from_base > 0 then
      insert into public.usage_ledger (workspace_id, campaign_id, kind, prospects, period_start, reason)
      values (p_ws, p_campaign, 'consume', v_n - v_from_base, v_period, 'extra');
    end if;
  end if;
  return v_n;
end $$;
