-- Analytics as SQL aggregates (docs/01 rule: analytics are SQL, never LLM or
-- client-side loops over rows).

-- Customer analytics for one workspace. Members only (checked inside).
create or replace function public.workspace_analytics(p_ws uuid, p_since timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_workspace_member(p_ws) and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not a member' using errcode = '42501';
  end if;
  with p as (
    select email_status, seniority, match_score, country from prospects where workspace_id = p_ws and created_at >= p_since
  ),
  totals as (
    select count(*) as total,
           count(*) filter (where email_status = 'verified') as verified,
           count(*) filter (where seniority in ('founder', 'c_level', 'vp', 'director', 'head')) as decision_makers,
           count(*) filter (where match_score is not null) as scored,
           count(*) filter (where match_score >= 70) as qualified
    from p
  ),
  markets as (
    select coalesce(jsonb_agg(jsonb_build_object('country', country, 'count', n) order by n desc), '[]') as list
    from (select country, count(*) as n from p where country is not null group by country) x
  )
  select jsonb_build_object(
    'prospects', t.total, 'verified', t.verified, 'decision_makers', t.decision_makers, 'scored', t.scored, 'qualified', t.qualified,
    'companies', (select count(*) from companies where workspace_id = p_ws and created_at >= p_since),
    'markets', m.list
  ) into v
  from totals t, markets m;
  return v;
end $$;
revoke execute on function public.workspace_analytics(uuid, timestamptz) from public, anon;
grant execute on function public.workspace_analytics(uuid, timestamptz) to authenticated, service_role;

-- Platform metrics for Yolias Admin (docs/09 "Admin analytics"). Service role only.
create or replace function public.admin_platform_metrics(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public, intel
as $$
  select jsonb_build_object(
    'active_users', (select count(distinct created_by) from strategies where created_at >= p_since),
    'active_workspaces', (select count(distinct workspace_id) from strategies where created_at >= p_since),
    'campaigns', (select count(*) from campaigns where created_at >= p_since),
    'campaigns_completed', (select count(*) from campaigns where created_at >= p_since and status = 'completed'),
    'campaigns_partial', (select count(*) from campaigns where created_at >= p_since and status = 'partial'),
    'campaigns_failed', (select count(*) from campaigns where created_at >= p_since and status = 'failed'),
    'prospects', (select count(*) from prospects where created_at >= p_since),
    'prospects_verified', (select count(*) from prospects where created_at >= p_since and email_status = 'verified'),
    'avg_match_score', (select round(avg(match_score)::numeric, 1) from prospects where created_at >= p_since and match_score is not null),
    'reused_prospects', (select count(*) from prospects pr where pr.created_at >= p_since and pr.person_id is not null
                          and exists (select 1 from prospects o where o.person_id = pr.person_id and o.workspace_id <> pr.workspace_id and o.created_at < pr.created_at)),
    'icp_calls', (select count(*) from intel.llm_calls where created_at >= p_since and task = 'icp.parse'),
    'icp_cache_hits', (select count(*) from intel.llm_calls where created_at >= p_since and task = 'icp.parse' and cache_hit),
    'provider_calls', (select count(*) from intel.provider_calls where created_at >= p_since),
    'provider_failures', (select count(*) from intel.provider_calls where created_at >= p_since and not ok),
    'provider_p50_ms', (select percentile_cont(0.5) within group (order by latency_ms) from intel.provider_calls where created_at >= p_since and latency_ms is not null),
    'canceled_workspaces', (select count(distinct workspace_id) from subscription_events where created_at >= p_since and status in ('canceled', 'ended'))
  );
$$;
revoke execute on function public.admin_platform_metrics(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_platform_metrics(timestamptz) to service_role;
