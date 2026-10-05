-- D-114: a call without a known price is "unpriced" (cost null), never free.
-- Before this, unknown costs were stored as 0.
alter table intel.llm_calls alter column cost_usd drop not null, alter column cost_usd drop default;
alter table intel.provider_calls alter column cost_usd drop not null, alter column cost_usd drop default;

drop function if exists intel.cost_summary(timestamptz);
create function intel.cost_summary(p_since timestamptz)
returns table (kind text, key text, calls bigint, failures bigint, cache_hits bigint, cost_usd numeric, records bigint, avg_latency_ms numeric, unpriced bigint)
language sql
stable
security definer
set search_path = intel, public
as $$
  select 'provider', provider || ' · ' || capability, count(*), count(*) filter (where not ok), count(*) filter (where cache_hit),
         coalesce(sum(cost_usd), 0), coalesce(sum(records_returned), 0)::bigint, round(avg(latency_ms)),
         count(*) filter (where cost_usd is null)
  from intel.provider_calls where created_at >= p_since group by provider, capability
  union all
  select 'llm', task || ' · ' || model, count(*), count(*) filter (where not ok), count(*) filter (where cache_hit),
         coalesce(sum(cost_usd), 0), coalesce(sum(input_tokens + output_tokens), 0)::bigint, round(avg(latency_ms)),
         count(*) filter (where cost_usd is null)
  from intel.llm_calls where created_at >= p_since group by task, model;
$$;
revoke execute on function intel.cost_summary(timestamptz) from public, anon, authenticated;
grant execute on function intel.cost_summary(timestamptz) to service_role;
