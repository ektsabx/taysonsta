-- Audit plan, phase 6 (2026-11-03): Admin → AI & algorithms → AI operations.
-- Every AI task by prompt version: calls, failures, latency, cost and models,
-- so a prompt change and its effect are visible side by side. Service role only.
create or replace function public.admin_llm_ops(p_since timestamptz)
returns table (
  task text, prompt_version text, calls bigint, failed bigint, cache_hits bigint,
  avg_latency_ms numeric, p95_latency_ms numeric, cost_usd numeric, models text[], first_at timestamptz, last_at timestamptz
)
language sql stable
set search_path = public, intel
as $$
  select c.task, coalesce(c.prompt_version, '-'), count(*), count(*) filter (where not c.ok), count(*) filter (where c.cache_hit),
    round(avg(c.latency_ms)::numeric, 0), round((percentile_cont(0.95) within group (order by c.latency_ms))::numeric, 0),
    coalesce(sum(c.cost_usd), 0), array_agg(distinct coalesce(c.served_model, c.model)), min(c.created_at), max(c.created_at)
  from intel.llm_calls c
  where c.created_at >= p_since
  group by c.task, coalesce(c.prompt_version, '-')
$$;
revoke all on function public.admin_llm_ops(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_llm_ops(timestamptz) to service_role;
