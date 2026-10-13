-- Daily usage limits per account (2026-10-12).
-- Every search and every Yolias AI message can cost an LLM call (Gemini).
-- These counters cap them per signed-in user and UTC day, separately from
-- the monthly Prospects allowance (usage_ledger) and purchased packs.
--
-- Atomic: consume_daily_usage increments only while the counter is below
-- the limit, in one statement (row lock on conflict), so concurrent requests
-- can never pass the limit. release_daily_usage gives one back when the work
-- did not happen (e.g. saving the search failed). Both run with the service
-- role only: a member can read their own counters but never change them.
-- Additive only.

create table if not exists public.daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('search', 'ai_message')),
  used int not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day, kind)
);

alter table public.daily_usage enable row level security;
drop policy if exists "own daily usage" on public.daily_usage;
create policy "own daily usage" on public.daily_usage for select using (user_id = auth.uid());
grant select on public.daily_usage to authenticated;

-- The UTC day Yolias counts in (resets at 00:00 UTC, like monthly billing).
create or replace function public.usage_day(ts timestamptz default now())
returns date language sql immutable as $$
  select (ts at time zone 'utc')::date;
$$;

-- Returns the new count when allowed, null when the limit is reached.
create or replace function public.consume_daily_usage(p_user uuid, p_kind text, p_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
begin
  if p_limit is null or p_limit <= 0 then
    return null;
  end if;
  insert into public.daily_usage as d (user_id, day, kind, used)
  values (p_user, public.usage_day(), p_kind, 1)
  on conflict (user_id, day, kind) do update
    set used = d.used + 1, updated_at = now()
    where d.used < p_limit
  returning d.used into v_used;
  return v_used;
end;
$$;

create or replace function public.release_daily_usage(p_user uuid, p_kind text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.daily_usage
     set used = used - 1, updated_at = now()
   where user_id = p_user and day = public.usage_day() and kind = p_kind and used > 0;
$$;

revoke all on function public.consume_daily_usage(uuid, text, int) from public, anon, authenticated;
revoke all on function public.release_daily_usage(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_daily_usage(uuid, text, int) to service_role;
grant execute on function public.release_daily_usage(uuid, text) to service_role;
