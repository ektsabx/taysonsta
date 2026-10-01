-- Spend per provider today and this month, for the budget guard (docs/05).
create or replace function intel.provider_spend(p_day_start timestamptz, p_month_start timestamptz)
returns table (provider text, spent_today numeric, spent_month numeric, calls_today bigint)
language sql
stable
security definer
set search_path = intel, public
as $$
  select provider,
         coalesce(sum(cost_usd) filter (where created_at >= p_day_start), 0),
         coalesce(sum(cost_usd), 0),
         count(*) filter (where created_at >= p_day_start)
  from intel.provider_calls
  where created_at >= least(p_day_start, p_month_start)
  group by provider;
$$;
revoke execute on function intel.provider_spend(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function intel.provider_spend(timestamptz, timestamptz) to service_role;
