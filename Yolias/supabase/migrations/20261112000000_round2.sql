-- Owner brief 2026-10-13 (round 2). See docs/12 D-200 onwards.

-- ── Status page: "no data" checks don't count in uptime ────────────────────
create or replace function public.status_record(p_component text, p_status text, p_latency int, p_detail text)
returns int
language plpgsql security definer set search_path = public
as $$
declare v_streak int; v_counts int := case when p_status = 'no_data' then 0 else 1 end;
begin
  insert into public.status_checks (component_id, status, latency_ms, detail) values (p_component, p_status, p_latency, left(p_detail, 200));
  insert into public.status_daily (component_id, day, total, ok, degraded, outage)
  values (p_component, (now() at time zone 'utc')::date, v_counts,
    case when p_status = 'operational' then 1 else 0 end,
    case when p_status = 'degraded' then 1 else 0 end,
    case when p_status in ('partial_outage', 'major_outage') then 1 else 0 end)
  on conflict (component_id, day) do update set total = status_daily.total + excluded.total, ok = status_daily.ok + excluded.ok,
    degraded = status_daily.degraded + excluded.degraded, outage = status_daily.outage + excluded.outage;
  update public.status_components set
    fail_streak = case when p_status in ('operational', 'no_data') then 0 else fail_streak + 1 end,
    last_status = p_status, last_checked_at = now(), last_latency_ms = p_latency, updated_at = now()
  where id = p_component
  returning fail_streak into v_streak;
  delete from public.status_checks where component_id = p_component and checked_at < now() - interval '14 days';
  return v_streak;
end $$;

-- Recount the days still covered by raw checks without the "no data" ones.
update public.status_daily d set total = x.total, ok = x.ok, degraded = x.degraded, outage = x.outage
from (
  select component_id, (checked_at at time zone 'utc')::date as day,
    count(*) filter (where status <> 'no_data')::int as total,
    count(*) filter (where status = 'operational')::int as ok,
    count(*) filter (where status = 'degraded')::int as degraded,
    count(*) filter (where status in ('partial_outage', 'major_outage'))::int as outage
  from public.status_checks group by 1, 2
) x
where d.component_id = x.component_id and d.day = x.day;

-- ── "Was this helpful?" on articles ─────────────────────────────────────────
create table public.content_feedback (
  kind text not null check (kind in ('docs', 'help', 'blog')),
  slug text not null check (slug ~ '^[a-z0-9-]{1,120}$'),
  visitor_id uuid not null,
  helpful boolean not null,
  locale text not null default 'en' check (locale in ('en', 'ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (kind, slug, visitor_id)
);
alter table public.content_feedback enable row level security;
-- Written by the server only; Admin reads the totals with the service role.
create or replace view public.content_feedback_totals as
  select kind, slug, count(*) filter (where helpful) as helpful, count(*) filter (where not helpful) as not_helpful
  from public.content_feedback group by kind, slug;
revoke all on public.content_feedback_totals from anon, authenticated;

-- ── Packs: prospects + emails together; uploaded contacts unlimited (D-203) ─
-- Yolias charges for what customers get from it: prospects and emails. A pack
-- adds both; its emails, like its prospects, never expire and are used once
-- the plan's monthly emails are gone ('extra_email' consume rows).
alter table public.prospect_packs add column emails int not null default 0 check (emails >= 0 and emails <= 1000000);
update public.prospect_packs set emails = prospects where emails = 0;
alter table public.usage_ledger add column emails int not null default 0 check (emails >= 0);

-- The plan's own monthly email allowance (trial / plan, minus the trial carry).
create or replace function public.monthly_base_limit(p_ws uuid, p_kind text)
returns int language sql stable security definer set search_path = public as $$
  select case
    when p_kind = 'contacts' then 1000000000
    when w.subscription_status = 'trialing' then greatest((select emails from public.trial_limits()) - public.trial_used_before(p_ws, 'emails'), 0)
    else greatest(coalesce(pq.emails_per_month, 0) - public.trial_carry_for(p_ws, 'emails'), 0)
  end
  from public.workspaces w left join public.plan_quotas pq on pq.plan = w.plan
  where w.id = p_ws;
$$;

-- Bought emails still available (every pack email ever − every extra email used).
create or replace function public.extra_emails_left(p_ws uuid)
returns int language sql stable security definer set search_path = public as $$
  select greatest(
    coalesce(sum(emails) filter (where kind = 'grant' and reason like 'prospect_pack:%'), 0)
    - coalesce(sum(emails) filter (where kind = 'consume' and reason = 'extra_email'), 0), 0)::int
  from public.usage_ledger where workspace_id = p_ws;
$$;

-- This month's limit = plan + bought emails used this month + bought emails left.
create or replace function public.monthly_limit(p_ws uuid, p_kind text)
returns int language sql stable security definer set search_path = public as $$
  select case when p_kind = 'contacts' then 1000000000
    else public.monthly_base_limit(p_ws, 'emails')
      + coalesce((select sum(emails) from public.usage_ledger where workspace_id = p_ws and kind = 'consume' and reason = 'extra_email' and period_start = public.usage_period_start()), 0)::int
      + public.extra_emails_left(p_ws)
  end;
$$;

-- An email counts the first time it is opened in a month; past the plan's
-- emails it draws one bought email (recorded), else it's refused.
create or replace function public.outreach_email_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.channel <> 'email' or new.opened_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.opened_at is not null
     and public.usage_period_start(old.opened_at) = public.usage_period_start(new.opened_at) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('emails:' || new.workspace_id::text, 0));
  if public.monthly_used(new.workspace_id, 'emails') >= public.monthly_limit(new.workspace_id, 'emails') then
    raise exception 'email_limit_reached' using errcode = 'P0001';
  end if;
  if public.monthly_used(new.workspace_id, 'emails') >= public.monthly_base_limit(new.workspace_id, 'emails')
     + coalesce((select sum(emails) from public.usage_ledger where workspace_id = new.workspace_id and kind = 'consume' and reason = 'extra_email' and period_start = public.usage_period_start()), 0) then
    insert into public.usage_ledger (workspace_id, kind, prospects, emails, period_start, reason, created_by)
    values (new.workspace_id, 'consume', 0, 1, public.usage_period_start(), 'extra_email', 'email');
  end if;
  return new;
end $$;

revoke execute on function public.monthly_base_limit(uuid, text) from public, anon, authenticated;
revoke execute on function public.extra_emails_left(uuid) from public, anon, authenticated;
grant execute on function public.monthly_base_limit(uuid, text) to service_role;
grant execute on function public.extra_emails_left(uuid) to service_role;

-- ── One agent (D-205): the customer-acquisition goal the member gives it ─────
alter table public.workspace_ai_settings add column goal text check (goal is null or length(goal) <= 2000);
