-- Revenue vs cost per workspace for Yolias Admin (docs/09 §B "Revenue ·
-- Platform costs · Cost per prospect", rule 39: real data only). Revenue =
-- paid invoices (live and test kept apart: test revenue isn't money);
-- cost = logged LLM + provider calls attributed to the workspace.
create or replace function public.admin_profitability(p_since timestamptz)
returns table (workspace_id uuid, name text, plan text, revenue_live numeric, revenue_test numeric, llm_cost numeric, provider_cost numeric, unpriced_calls bigint, prospects bigint)
language sql
stable
security definer
set search_path = public, intel
as $$
  with rev as (
    select workspace_id,
           coalesce(sum(amount_usd) filter (where mode = 'live'), 0) as live,
           coalesce(sum(amount_usd) filter (where mode = 'test'), 0) as test
    from public.invoices where status = 'paid' and created_at >= p_since group by workspace_id
  ),
  llm as (
    select workspace_id, coalesce(sum(cost_usd), 0) as cost, count(*) filter (where cost_usd is null and not cache_hit) as unpriced
    from intel.llm_calls where created_at >= p_since and workspace_id is not null group by workspace_id
  ),
  prov as (
    select workspace_id, coalesce(sum(cost_usd), 0) as cost, count(*) filter (where cost_usd is null) as unpriced
    from intel.provider_calls where created_at >= p_since and workspace_id is not null group by workspace_id
  ),
  used as (
    select workspace_id, coalesce(sum(prospects), 0) as n
    from public.usage_ledger where kind = 'consume' and created_at >= p_since group by workspace_id
  )
  select w.id, w.name, w.plan,
         coalesce(rev.live, 0), coalesce(rev.test, 0), coalesce(llm.cost, 0), coalesce(prov.cost, 0),
         coalesce(llm.unpriced, 0) + coalesce(prov.unpriced, 0), coalesce(used.n, 0)
  from public.workspaces w
  left join rev on rev.workspace_id = w.id
  left join llm on llm.workspace_id = w.id
  left join prov on prov.workspace_id = w.id
  left join used on used.workspace_id = w.id
  where rev.workspace_id is not null or llm.workspace_id is not null or prov.workspace_id is not null or used.workspace_id is not null;
$$;
revoke execute on function public.admin_profitability(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_profitability(timestamptz) to service_role;
