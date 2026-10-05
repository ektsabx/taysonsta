-- Yolias AI usage for Yolias Admin (docs/09 §B, rule 35): one SQL aggregate.
-- Counts only; conversation text is not exposed here.
create or replace function public.admin_agent_metrics(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public, intel
as $$
  select jsonb_build_object(
    'conversations', (select count(distinct strategy_id) from public.agent_messages where created_at >= p_since),
    'workspaces', (select count(distinct workspace_id) from public.agent_messages where created_at >= p_since and role = 'user'),
    'user_turns', (select count(*) from public.agent_messages where created_at >= p_since and role = 'user'),
    'assistant_turns', (select count(*) from public.agent_messages where created_at >= p_since and role = 'assistant'),
    'tool_calls', (select count(*) from public.agent_tool_calls where created_at >= p_since),
    'by_outcome', coalesce((select jsonb_object_agg(outcome, n) from (select outcome, count(*) n from public.agent_tool_calls where created_at >= p_since group by outcome) o), '{}'::jsonb),
    'by_tool', coalesce((select jsonb_agg(jsonb_build_object('tool', tool, 'calls', n, 'failures', f, 'avg_ms', ms) order by n desc) from (
      select tool, count(*) n, count(*) filter (where not ok) f, round(avg(latency_ms))::int ms
      from public.agent_tool_calls where created_at >= p_since group by tool) t), '[]'::jsonb),
    'llm_calls', (select count(*) from intel.llm_calls where task = 'agent' and created_at >= p_since),
    'llm_cost_usd', (select coalesce(sum(cost_usd), 0) from intel.llm_calls where task = 'agent' and created_at >= p_since)
  );
$$;
revoke execute on function public.admin_agent_metrics(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_agent_metrics(timestamptz) to service_role;
