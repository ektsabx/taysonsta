-- Yolias AI metrics for Yolias Admin, final spec phase 7: conversations by
-- kind, cost per tool call, LLM cost per orchestrator task (reasoning /
-- research / extraction) and reply feedback. Counts and money only — no text.
create or replace function public.admin_agent_metrics(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public, intel
as $$
  select jsonb_build_object(
    'conversations', (select count(distinct conversation_id) from public.agent_messages where created_at >= p_since),
    'by_scope', coalesce((select jsonb_object_agg(scope, n) from (
      select c.scope, count(distinct c.id) n from public.conversations c join public.agent_messages m on m.conversation_id = c.id
      where m.created_at >= p_since group by c.scope) s), '{}'::jsonb),
    'workspaces', (select count(distinct workspace_id) from public.agent_messages where created_at >= p_since and role = 'user'),
    'user_turns', (select count(*) from public.agent_messages where created_at >= p_since and role = 'user'),
    'assistant_turns', (select count(*) from public.agent_messages where created_at >= p_since and role = 'assistant'),
    'likes', (select count(*) from public.agent_feedback where rating = 1 and created_at >= p_since),
    'dislikes', (select count(*) from public.agent_feedback where rating = -1 and created_at >= p_since),
    'tool_calls', (select count(*) from public.agent_tool_calls where created_at >= p_since),
    'tool_cost_usd', (select coalesce(sum(cost_usd), 0) from public.agent_tool_calls where created_at >= p_since),
    'tool_unpriced', (select coalesce(sum(unpriced_calls), 0) from public.agent_tool_calls where created_at >= p_since),
    'by_outcome', coalesce((select jsonb_object_agg(outcome, n) from (select outcome, count(*) n from public.agent_tool_calls where created_at >= p_since group by outcome) o), '{}'::jsonb),
    'by_tool', coalesce((select jsonb_agg(jsonb_build_object('tool', tool, 'calls', n, 'failures', f, 'avg_ms', ms, 'cost_usd', cost, 'unpriced', unpriced) order by n desc) from (
      select tool, count(*) n, count(*) filter (where not ok) f, round(avg(latency_ms))::int ms, coalesce(sum(cost_usd), 0) cost, coalesce(sum(unpriced_calls), 0) unpriced
      from public.agent_tool_calls where created_at >= p_since group by tool) t), '[]'::jsonb),
    'by_task', coalesce((select jsonb_agg(jsonb_build_object('task', task, 'calls', n, 'cost_usd', cost, 'unpriced', unpriced) order by task) from (
      select task, count(*) n, coalesce(sum(cost_usd), 0) cost, count(*) filter (where cost_usd is null and not cache_hit) unpriced
      from intel.llm_calls where task in ('agent', 'research', 'extract') and created_at >= p_since group by task) k), '[]'::jsonb),
    'llm_calls', (select count(*) from intel.llm_calls where task in ('agent', 'research', 'extract') and created_at >= p_since),
    'llm_cost_usd', (select coalesce(sum(cost_usd), 0) from intel.llm_calls where task in ('agent', 'research', 'extract') and created_at >= p_since)
  );
$$;
revoke execute on function public.admin_agent_metrics(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_agent_metrics(timestamptz) to service_role;
