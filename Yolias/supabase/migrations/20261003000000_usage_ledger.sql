-- Prospect quotas as configuration + the usage ledger (docs/06-usage-pricing-cost.md,
-- rules 26–29). Customers pay for delivered prospects only. Work reserves
-- prospects atomically first, delivery consumes them, the rest is released.

-- ───────────────────────── Plan catalogue ─────────────────────────

create table public.plan_quotas (
  plan text primary key check (plan in ('free', 'pro', 'growth')),
  price_usd numeric(10, 2) not null check (price_usd >= 0),
  prospects_per_month int not null check (prospects_per_month >= 0),
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into public.plan_quotas (plan, price_usd, prospects_per_month) values
  ('free', 0, 50),
  ('pro', 20, 1000),
  ('growth', 50, 3000);

alter table public.plan_quotas enable row level security;
-- Public: the pricing page shows it to everyone. Writes: service role only (Yolias Admin).
create policy "anyone reads plans" on public.plan_quotas for select using (true);
grant select on public.plan_quotas to anon, authenticated;

-- ───────────────────────── Usage ledger ─────────────────────────

create table public.usage_ledger (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  kind text not null check (kind in ('reserve', 'consume', 'release', 'grant', 'adjust')),
  -- Always positive, except 'adjust' (an admin correction, either sign).
  prospects int not null check (kind = 'adjust' or prospects >= 0),
  period_start date not null,
  reason text,
  created_by text,
  created_at timestamptz not null default now()
);
create index usage_ledger_ws_period_idx on public.usage_ledger (workspace_id, period_start);
create index usage_ledger_campaign_idx on public.usage_ledger (campaign_id) where campaign_id is not null;

alter table public.usage_ledger enable row level security;
create policy "members read usage" on public.usage_ledger for select using (public.is_workspace_member(workspace_id));
grant select on public.usage_ledger to authenticated;

-- Calendar month in UTC, like the rest of Yolias billing.
create or replace function public.usage_period_start(ts timestamptz default now())
returns date language sql immutable as $$
  select date_trunc('month', ts at time zone 'utc')::date;
$$;

-- Balance for the current period:
--   allowance = plan quota + grants + adjustments
--   used      = consumed
--   reserved  = reserved − consumed − released (still held by running work)
--   available = allowance − used − reserved
create or replace function public.usage_summary(p_ws uuid)
returns table (period_start date, quota int, granted int, allowance int, consumed int, reserved int, available int)
language sql
stable
security definer
set search_path = public
as $$
  with p as (select public.usage_period_start() as ps),
  q as (
    select coalesce(pq.prospects_per_month, 0) as quota
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

-- Held by a campaign and not yet consumed or released (in the period it was reserved).
create or replace function public.usage_outstanding(p_campaign uuid)
returns table (period_start date, outstanding int)
language sql
stable
security definer
set search_path = public
as $$
  select period_start,
         (coalesce(sum(prospects) filter (where kind = 'reserve'), 0)
          - coalesce(sum(prospects) filter (where kind in ('consume', 'release')), 0))::int
  from public.usage_ledger
  where campaign_id = p_campaign
  group by period_start
  order by period_start desc
  limit 1;
$$;

-- Reserves up to p_n prospects for a campaign; returns how many were reserved
-- (0 = nothing left this month). Serialised per workspace, so two campaigns
-- can never reserve the same prospects.
create or replace function public.reserve_usage(p_ws uuid, p_campaign uuid, p_n int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available int;
  v_n int;
begin
  perform pg_advisory_xact_lock(hashtextextended('usage:' || p_ws::text, 0));
  select available into v_available from public.usage_summary(p_ws);
  v_n := least(greatest(p_n, 0), coalesce(v_available, 0));
  if v_n > 0 then
    insert into public.usage_ledger (workspace_id, campaign_id, kind, prospects, period_start, reason)
    values (p_ws, p_campaign, 'reserve', v_n, public.usage_period_start(), 'campaign start');
  end if;
  return v_n;
end $$;

-- Converts held prospects into used ones when they are delivered. Returns how
-- many were consumed (never more than the campaign holds).
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
begin
  perform pg_advisory_xact_lock(hashtextextended('usage:' || p_ws::text, 0));
  select period_start, outstanding into v_period, v_left from public.usage_outstanding(p_campaign);
  v_n := least(greatest(p_n, 0), coalesce(v_left, 0));
  if v_n > 0 then
    insert into public.usage_ledger (workspace_id, campaign_id, kind, prospects, period_start, reason)
    values (p_ws, p_campaign, 'consume', v_n, v_period, 'prospect delivered');
  end if;
  return v_n;
end $$;

-- Returns whatever a campaign still holds (it finished, stopped or failed).
create or replace function public.release_usage(p_ws uuid, p_campaign uuid, p_reason text default 'campaign ended')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date;
  v_left int;
begin
  perform pg_advisory_xact_lock(hashtextextended('usage:' || p_ws::text, 0));
  select period_start, outstanding into v_period, v_left from public.usage_outstanding(p_campaign);
  if coalesce(v_left, 0) > 0 then
    insert into public.usage_ledger (workspace_id, campaign_id, kind, prospects, period_start, reason)
    values (p_ws, p_campaign, 'release', v_left, v_period, p_reason);
    return v_left;
  end if;
  return 0;
end $$;

revoke execute on function public.usage_summary(uuid) from public, anon, authenticated;
revoke execute on function public.usage_outstanding(uuid) from public, anon, authenticated;
revoke execute on function public.reserve_usage(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.consume_usage(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.release_usage(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.usage_summary(uuid) to service_role;
grant execute on function public.usage_outstanding(uuid) to service_role;
grant execute on function public.reserve_usage(uuid, uuid, int) to service_role;
grant execute on function public.consume_usage(uuid, uuid, int) to service_role;
grant execute on function public.release_usage(uuid, uuid, text) to service_role;

-- Prospects delivered before the ledger existed count as consumed in their month.
insert into public.usage_ledger (workspace_id, campaign_id, kind, prospects, period_start, reason)
select workspace_id, campaign_id, 'consume', count(*), public.usage_period_start(created_at), 'backfill'
from public.prospects
group by workspace_id, campaign_id, public.usage_period_start(created_at);
