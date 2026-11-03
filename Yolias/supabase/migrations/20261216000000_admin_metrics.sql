-- D-276 (owner, 2026-11-03): the numbers Yolias Admin's dashboard shows.
-- Monthly costs the owner enters (fixed costs, and marketing spend per
-- channel, for profit, margin and CAC), and server-side totals over page
-- views (site_visits), platform costs (intel) and sessions, so the Admin
-- never loads raw rows to count them. Service role only.

create table if not exists public.yolias_finance_entries (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  kind text not null check (kind in ('fixed', 'marketing')),
  -- fixed: servers, database, email, software, salaries, other…; marketing: a channel (seo, geo, paid_ads, social, affiliate, other).
  category text not null check (char_length(category) between 1 and 40),
  amount_usd numeric(12, 2) not null check (amount_usd >= 0),
  -- Fixed costs that serve customers directly (servers, database, email sending) count in gross margin.
  cogs boolean not null default false,
  note text check (note is null or char_length(note) <= 300),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month, kind, category)
);
alter table public.yolias_finance_entries enable row level security;
revoke all on public.yolias_finance_entries from anon, authenticated;

-- Page views, visits and visitors per day (UTC), for one area or both.
create or replace function public.admin_traffic_daily(p_since timestamptz, p_until timestamptz, p_area text default null)
returns table (day date, views bigint, visits bigint, visitors bigint)
language sql stable security definer set search_path = public as $$
  select (created_at at time zone 'utc')::date, count(*), count(distinct session), count(distinct visitor)
  from public.site_visits
  where created_at >= p_since and created_at < p_until and (p_area is null or area = p_area)
  group by 1 order by 1;
$$;

-- Totals by one dimension. A visit's channel is its first page's.
create or replace function public.admin_traffic_by(p_since timestamptz, p_until timestamptz, p_dim text, p_area text default null, p_limit int default 50)
returns table (key text, views bigint, visits bigint, visitors bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_dim not in ('channel', 'engine', 'country', 'city', 'device', 'browser', 'os', 'path', 'landing', 'referrer_host', 'locale', 'utm_campaign') then
    raise exception 'unknown dimension %', p_dim;
  end if;
  -- 'landing': the first page of each visit.
  if p_dim in ('channel', 'engine', 'referrer_host', 'utm_campaign', 'landing') then
    return query execute format(
      'with s as (select session, %1$I as k from public.site_visits where landing and created_at >= $1 and created_at < $2 and ($3 is null or area = $3))
       select coalesce(s.k, ''unknown'')::text, count(v.*)::bigint, count(distinct v.session)::bigint, count(distinct v.visitor)::bigint
       from s join public.site_visits v on v.session = s.session group by 1 order by 3 desc limit $4', case when p_dim = 'landing' then 'path' else p_dim end)
      using p_since, p_until, p_area, p_limit;
  else
    return query execute format(
      'select coalesce(%1$I, ''unknown'')::text, count(*)::bigint, count(distinct session)::bigint, count(distinct visitor)::bigint
       from public.site_visits where created_at >= $1 and created_at < $2 and ($3 is null or area = $3) group by 1 order by 3 desc limit $4', p_dim)
      using p_since, p_until, p_area, p_limit;
  end if;
end $$;

-- Who is on Yolias now: each visitor's latest page view in the last minutes.
create or replace function public.admin_live_visitors(p_minutes int default 5)
returns table (visitor text, user_id uuid, workspace_id uuid, area text, path text, country text, city text, ip text, device text, os text, browser text, channel text, last_at timestamptz, views bigint, visits_total bigint)
language sql stable security definer set search_path = public as $$
  with recent as (
    select distinct on (visitor) * from public.site_visits
    where created_at >= now() - make_interval(mins => greatest(1, least(p_minutes, 60)))
    order by visitor, created_at desc
  )
  select r.visitor, r.user_id, r.workspace_id, r.area, r.path, r.country, r.city, host(r.ip), r.device, r.os, r.browser,
         (select v.channel from public.site_visits v where v.session = r.session and v.landing limit 1),
         r.created_at,
         (select count(*) from public.site_visits v where v.session = r.session),
         (select count(distinct v.session) from public.site_visits v where v.visitor = r.visitor or (r.user_id is not null and v.user_id = r.user_id))
  from recent r order by r.created_at desc;
$$;

-- Platform costs per day: model calls and data providers (USD).
create or replace function public.admin_costs_daily(p_since timestamptz, p_until timestamptz)
returns table (day date, llm numeric, provider numeric)
language sql stable security definer set search_path = public, intel as $$
  with d as (
    select (created_at at time zone 'utc')::date as day, coalesce(sum(cost_usd), 0) as llm, 0::numeric as provider from intel.llm_calls where created_at >= p_since and created_at < p_until group by 1
    union all
    select (created_at at time zone 'utc')::date, 0, coalesce(sum(cost_usd), 0) from intel.provider_calls where created_at >= p_since and created_at < p_until group by 1
  )
  select day, sum(llm), sum(provider) from d group by day order by day;
$$;

revoke execute on function public.admin_traffic_daily(timestamptz, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.admin_traffic_by(timestamptz, timestamptz, text, text, int) from public, anon, authenticated;
revoke execute on function public.admin_live_visitors(int) from public, anon, authenticated;
revoke execute on function public.admin_costs_daily(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_traffic_daily(timestamptz, timestamptz, text) to service_role;
grant execute on function public.admin_traffic_by(timestamptz, timestamptz, text, text, int) to service_role;
grant execute on function public.admin_live_visitors(int) to service_role;
grant execute on function public.admin_costs_daily(timestamptz, timestamptz) to service_role;
