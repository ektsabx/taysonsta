-- Subscription journey tracking + account administration (owner brief 2026-10-13, D-212..D-215).
-- New tables only; nothing existing is dropped or retyped. Every table here is
-- service-role only (RLS on, no policies): customers never read them, Yolias
-- writes them from the server and Yolias Admin reads them after its own
-- permission check. Names are unique across Yolias and Admin (shared
-- production database, D-148).

-- ── Checkout sessions: one row per subscription checkout attempt ───────────
create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  plan text,
  billing_period text,
  -- The payment method the customer picked (polar | paymob), when known.
  provider text,
  -- Price shown when the checkout was opened (USD).
  amount_usd numeric(12, 2),
  currency text not null default 'USD',
  status text not null default 'opened' check (status in (
    'opened', 'details', 'payment_started', 'awaiting_result', 'payment_failed', 'abandoned', 'paid', 'activated', 'closed')),
  last_step text not null default 'checkout_opened',
  attempts int not null default 0,
  trial_offered boolean not null default false,
  -- What activated it: 'trial' (card saved, trial started) or 'paid'.
  outcome text check (outcome in ('trial', 'paid')),
  source text,
  campaign text,
  device text,
  browser text,
  country text,
  opened_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  details_at timestamptz,
  payment_started_at timestamptz,
  redirected_at timestamptz,
  returned_at timestamptz,
  return_result text,
  paid_at timestamptz,
  activated_at timestamptz,
  failed_at timestamptz,
  abandoned_at timestamptz,
  closed_at timestamptz,
  recovered_at timestamptz,
  recovered_by uuid references public.checkout_sessions(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  provider_checkout_id text,
  failure_reason text,
  -- Why it didn't convert, from evidence only (see checkout_classify).
  reason_category text,
  -- Admin follow-up.
  review_status text not null default 'new' check (review_status in ('new', 'reviewed', 'excluded')),
  exclude_reason text,
  assigned_to text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checkout_sessions_ws on public.checkout_sessions (workspace_id, opened_at desc);
create index checkout_sessions_user on public.checkout_sessions (user_id, opened_at desc);
create index checkout_sessions_status on public.checkout_sessions (status, last_activity_at);
create index checkout_sessions_opened on public.checkout_sessions (opened_at desc);
alter table public.checkout_sessions enable row level security;

alter table public.payments add column if not exists checkout_id uuid references public.checkout_sessions(id) on delete set null;
create index if not exists payments_checkout on public.payments (checkout_id);

-- ── Funnel events: append-only, one row per real event, deduplicated by key ─
create table public.funnel_events (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  name text not null,
  user_id uuid,
  visitor_id text,
  workspace_id uuid,
  checkout_id uuid,
  payment_id uuid,
  provider text,
  plan text,
  billing_period text,
  -- true: confirmed by the server / provider; false: a page view or click.
  confirmed boolean not null default false,
  source text not null default 'server' check (source in ('client', 'server', 'webhook', 'worker', 'admin')),
  props jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index funnel_events_name_time on public.funnel_events (name, occurred_at);
create index funnel_events_user on public.funnel_events (user_id, occurred_at desc);
create index funnel_events_visitor on public.funnel_events (visitor_id) where visitor_id is not null;
create index funnel_events_checkout on public.funnel_events (checkout_id, occurred_at);
alter table public.funnel_events enable row level security;

create or replace function public.funnel_event(
  p_key text, p_name text, p_user uuid, p_workspace uuid, p_checkout uuid, p_payment uuid,
  p_provider text, p_plan text, p_period text, p_confirmed boolean, p_source text, p_props jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = public
as $$
  insert into public.funnel_events (event_key, name, user_id, workspace_id, checkout_id, payment_id, provider, plan, billing_period, confirmed, source, props)
  values (p_key, p_name, p_user, p_workspace, p_checkout, p_payment, p_provider, p_plan, p_period, p_confirmed, p_source, coalesce(p_props, '{}'::jsonb))
  on conflict (event_key) do nothing;
$$;

-- ── App sessions (opening Yolias): a session ends after 30 idle minutes ─────
create table public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  pings int not null default 1,
  device text,
  browser text,
  os text
);
create index app_sessions_user on public.app_sessions (user_id, last_seen_at desc);
create index app_sessions_started on public.app_sessions (started_at);
alter table public.app_sessions enable row level security;

create or replace function public.app_session_ping(p_user uuid, p_workspace uuid, p_device text, p_browser text, p_os text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from public.app_sessions
  where user_id = p_user and last_seen_at > now() - interval '30 minutes'
  order by last_seen_at desc limit 1 for update;
  if v_id is not null then
    -- At most one counted ping a minute (several tabs share a session).
    update public.app_sessions set last_seen_at = now(), pings = pings + case when last_seen_at < now() - interval '50 seconds' then 1 else 0 end where id = v_id;
    return v_id;
  end if;
  insert into public.app_sessions (user_id, workspace_id, device, browser, os) values (p_user, p_workspace, left(p_device, 20), left(p_browser, 40), left(p_os, 40)) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.app_session_ping(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.funnel_event(text, text, uuid, uuid, uuid, uuid, text, text, text, boolean, text, jsonb) from public, anon, authenticated;

-- ── Account administration (Admin only) ────────────────────────────────────
-- Suspension, temporary pause and ban are different states (all block sign-in
-- through the Auth ban); a subscription's own state is separate.
create table public.account_moderation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('active', 'suspended', 'paused', 'banned', 'deleted')),
  reason text,
  until timestamptz,
  changed_by text,
  changed_at timestamptz not null default now()
);
alter table public.account_moderation enable row level security;

-- Accounts suspended before this table existed keep their state.
insert into public.account_moderation (user_id, status, reason, changed_by, changed_at)
select u.id, 'suspended', null, null, now() from auth.users u
join public.profiles p on p.id = u.id
where u.banned_until is not null and u.banned_until > now()
on conflict (user_id) do nothing;

create table public.account_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_id uuid references public.checkout_sessions(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  author_id uuid,
  author_name text,
  created_at timestamptz not null default now()
);
create index account_notes_user on public.account_notes (user_id, created_at desc);
create index account_notes_checkout on public.account_notes (checkout_id) where checkout_id is not null;
alter table public.account_notes enable row level security;

-- Messages the Yolias team sends to one account (email / in-app), with their result.
create table public.account_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_id uuid references public.checkout_sessions(id) on delete set null,
  channel text not null check (channel in ('email', 'in_app', 'sms')),
  purpose text not null default 'service' check (purpose in ('service', 'recovery', 'marketing')),
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  cta_url text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  error text,
  sent_by uuid,
  sent_by_name text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index account_messages_user on public.account_messages (user_id, created_at desc);
create index account_messages_checkout on public.account_messages (checkout_id) where checkout_id is not null;
alter table public.account_messages enable row level security;

-- ── Payments → checkout (server truth; idempotent, safe for repeated callbacks) ─
-- BEFORE: links the payment to its checkout (the one it was opened from, else
-- the workspace's latest open subscription checkout). AFTER: moves the checkout
-- and records the confirmed result once (event keys are unique per payment).
create or replace function public.payments_checkout_link()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.checkout_id is null and new.kind = 'subscription' and new.status in ('pending', 'succeeded', 'failed') then
    select id into new.checkout_id from public.checkout_sessions
    where workspace_id = new.workspace_id and status not in ('activated', 'closed') and opened_at > now() - interval '30 days'
    order by last_activity_at desc limit 1;
  end if;
  return new;
end $$;
create trigger payments_checkout_link before insert or update of status on public.payments
for each row execute function public.payments_checkout_link();

create or replace function public.payments_checkout_effects()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_old text := case when tg_op = 'UPDATE' then old.status else null end;
begin
  if new.checkout_id is null or new.status is not distinct from v_old then return new; end if;
  if new.status = 'succeeded' then
    update public.checkout_sessions set
      status = case when status = 'activated' then status else 'paid' end,
      last_step = case when status = 'activated' then last_step else 'payment_succeeded' end,
      paid_at = coalesce(paid_at, now()), payment_id = new.id, provider = coalesce(provider, new.provider),
      last_activity_at = now(), updated_at = now(), failure_reason = null
    where id = new.checkout_id;
    perform public.funnel_event('payment_succeeded:' || new.id, 'payment_succeeded', new.created_by, new.workspace_id, new.checkout_id, new.id,
      new.provider, new.plan, new.billing_period, true, 'webhook', jsonb_build_object('amount', new.amount, 'currency', new.currency, 'mode', new.mode));
  elsif new.status = 'failed' then
    update public.checkout_sessions set
      status = case when status in ('paid', 'activated') then status else 'payment_failed' end,
      last_step = case when status in ('paid', 'activated') then last_step else 'payment_failed' end,
      failed_at = now(), payment_id = coalesce(payment_id, new.id), failure_reason = new.failure_reason,
      reason_category = case when new.failure_reason = 'checkout_failed' then 'technical_error' else 'payment_failed' end,
      last_activity_at = now(), updated_at = now()
    where id = new.checkout_id;
    perform public.funnel_event('payment_failed:' || new.id, 'payment_failed', new.created_by, new.workspace_id, new.checkout_id, new.id,
      new.provider, new.plan, new.billing_period, true, 'webhook', jsonb_build_object('reason', new.failure_reason, 'mode', new.mode));
  elsif new.status = 'pending' and tg_op = 'INSERT' then
    update public.checkout_sessions set payment_id = new.id, updated_at = now() where id = new.checkout_id;
  end if;
  return new;
end $$;
create trigger payments_checkout_effects after insert or update of status on public.payments
for each row execute function public.payments_checkout_effects();

-- ── Subscription events → checkout activated, recovery of abandoned checkouts ─
create or replace function public.subscription_events_checkout()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_cid uuid; v_user uuid; v_abandoned timestamptz;
begin
  if new.status not in ('activated', 'trial_started', 'trial_converted', 'changed') then return new; end if;
  select id, user_id, abandoned_at into v_cid, v_user, v_abandoned from public.checkout_sessions
  where workspace_id = new.workspace_id and status not in ('activated', 'closed') and opened_at > now() - interval '30 days'
  order by (status = 'paid') desc, last_activity_at desc limit 1;
  if v_cid is not null then
    update public.checkout_sessions set status = 'activated', last_step = 'subscription_activated', activated_at = now(),
      outcome = case when new.status = 'trial_started' then 'trial' else 'paid' end,
      recovered_at = case when abandoned_at is not null then now() else recovered_at end,
      last_activity_at = now(), updated_at = now()
    where id = v_cid;
  end if;
  perform public.funnel_event('subscription_activated:' || new.id, 'subscription_activated', coalesce(new.created_by, v_user), new.workspace_id, v_cid, null,
    null, new.plan, new.billing_period, true, 'server', jsonb_build_object('status', new.status, 'mode', new.mode, 'amount', new.amount));
  -- Earlier abandoned checkouts of this workspace are now recovered (their history stays).
  with rec as (
    update public.checkout_sessions set recovered_at = now(), recovered_by = v_cid, updated_at = now()
    where workspace_id = new.workspace_id and abandoned_at is not null and recovered_at is null and id is distinct from v_cid
    returning id, user_id, plan, billing_period
  )
  insert into public.funnel_events (event_key, name, user_id, workspace_id, checkout_id, plan, billing_period, confirmed, source, props)
  select 'checkout_recovered:' || rec.id, 'checkout_recovered', rec.user_id, new.workspace_id, rec.id, rec.plan, rec.billing_period, true, 'server', jsonb_build_object('by', v_cid)
  from rec on conflict (event_key) do nothing;
  if v_cid is not null and v_abandoned is not null then
    perform public.funnel_event('checkout_recovered:' || v_cid, 'checkout_recovered', v_user, new.workspace_id, v_cid, null, null, new.plan, new.billing_period, true, 'server', '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger subscription_events_checkout after insert on public.subscription_events
for each row execute function public.subscription_events_checkout();

-- ── Abandonment: only after a quiet period, never while a payment can still land ─
create or replace function public.checkout_classify(p_abandon_minutes int default 30, p_result_minutes int default 120, p_confirm_minutes int default 1440)
returns int
language plpgsql security definer set search_path = public
as $$
declare v_n int;
begin
  with moved as (
    update public.checkout_sessions c set
      status = 'abandoned', abandoned_at = now(), updated_at = now(),
      reason_category = case
        when c.status = 'opened' then 'left_before_details'
        when c.status = 'details' then 'no_payment_started'
        when c.status = 'payment_started' then
          case when exists (select 1 from public.funnel_events e where e.checkout_id = c.id and e.name = 'payment_error') then 'technical_error' else 'unknown' end
        when c.status = 'awaiting_result' and c.return_result = 'succeeded' then 'confirmation_missing'
        when c.status = 'awaiting_result' and c.return_result = 'expired' then 'gateway_expired'
        when c.status = 'awaiting_result' and c.returned_at is not null then 'returned_not_completed'
        when c.status = 'awaiting_result' then 'left_at_gateway'
        else 'unknown' end
    where (c.status in ('opened', 'details', 'payment_started') and c.last_activity_at < now() - make_interval(mins => p_abandon_minutes))
       or (c.status = 'awaiting_result' and coalesce(c.return_result, '') <> 'succeeded' and c.last_activity_at < now() - make_interval(mins => greatest(p_result_minutes, p_abandon_minutes)))
       or (c.status = 'awaiting_result' and c.return_result = 'succeeded' and c.last_activity_at < now() - make_interval(mins => p_confirm_minutes))
    returning c.id, c.user_id, c.workspace_id, c.plan, c.billing_period, c.provider, c.reason_category
  )
  insert into public.funnel_events (event_key, name, user_id, workspace_id, checkout_id, provider, plan, billing_period, confirmed, source, props)
  select 'checkout_abandoned:' || id, 'checkout_abandoned', user_id, workspace_id, id, provider, plan, billing_period, true, 'worker', jsonb_build_object('reason', reason_category)
  from moved on conflict (event_key) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.checkout_classify(int, int, int) from public, anon, authenticated;

-- ── Login history for Admin, from Supabase Auth's own audit log ────────────
create or replace function public.admin_login_history(p_user uuid, p_limit int default 50)
returns table (at timestamptz, action text, provider text, ip text)
language sql stable security definer set search_path = public, auth
as $$
  select e.created_at, e.payload->>'action', coalesce(e.payload->'traits'->>'provider', e.payload->'traits'->>'auth_method'), nullif(e.ip_address, '')
  from auth.audit_log_entries e
  where e.payload->>'actor_id' = p_user::text
    and e.payload->>'action' in ('login', 'logout', 'user_signedup', 'user_recovery_requested', 'user_repeated_signup', 'user_confirmation_requested', 'user_invited')
  order by e.created_at desc limit least(greatest(p_limit, 1), 200);
$$;
revoke all on function public.admin_login_history(uuid, int) from public, anon, authenticated;

-- ── One row per account for Admin's user tables (filters, sort, paging on the server) ─
create or replace view public.admin_accounts_v as
select
  p.id, p.email, p.full_name, p.avatar_url, p.created_at, p.country, p.language, p.acquisition_source, p.onboarded_at,
  p.workspace_id, w.name as workspace_name, m.role,
  coalesce(w.plan, 'free') as plan, coalesce(w.subscription_status, 'none') as subscription_status, w.billing_period, w.current_period_end,
  coalesce(w.cancel_at_period_end, false) as cancel_at_period_end, w.trial_started_at, w.trial_ends_at, w.billing_provider,
  (u.email_confirmed_at is not null) as email_confirmed, u.last_sign_in_at, u.banned_until,
  coalesce(am.status, case when u.banned_until is not null and u.banned_until > now() then 'suspended' else 'active' end) as account_status,
  am.reason as status_reason, am.until as status_until, am.changed_by as status_changed_by, am.changed_at as status_changed_at,
  coalesce(pay.paid_total, 0) as paid_total, coalesce(pay.refunded_total, 0) as refunded_total, coalesce(pay.paid_count, 0) as paid_count,
  pay.first_paid_at, pay.last_paid_at,
  lp.created_at as last_payment_at, lp.status as last_payment_status, lp.provider as last_payment_provider,
  coalesce(se.renewals, 0) as renewals,
  greatest(u.last_sign_in_at, s.last_seen_at) as last_activity_at,
  ck.status as last_checkout_status, ck.opened_at as last_checkout_at, ck.recovered_at as last_checkout_recovered_at,
  case
    when coalesce(am.status, 'active') = 'deleted' then 'deleted'
    when w.subscription_status = 'active' and w.plan <> 'free' then 'paid_active'
    when w.subscription_status = 'test' then 'test'
    when w.subscription_status = 'trialing' then 'trialing'
    when coalesce(pay.paid_count, 0) > 0 then 'lapsed'
    when ck.status = 'payment_failed' then 'payment_failed'
    when ck.status in ('payment_started', 'awaiting_result') then 'payment_pending'
    when ck.status in ('opened', 'details') or (ck.status = 'abandoned' and ck.payment_started_at is null) then 'checkout_no_payment'
    when ck.status = 'abandoned' then 'payment_not_completed'
    when w.trial_started_at is not null then 'trial_ended'
    when exists (select 1 from public.funnel_events fe where fe.user_id = p.id and fe.name = 'plan_selected') then 'plan_selected'
    else 'registered_only'
  end as segment
from public.profiles p
join auth.users u on u.id = p.id
left join public.workspaces w on w.id = p.workspace_id
left join public.workspace_members m on m.workspace_id = p.workspace_id and m.user_id = p.id
left join public.account_moderation am on am.user_id = p.id
left join lateral (
  select sum(amount) filter (where status in ('succeeded', 'refunded') and mode = 'live') as paid_total,
         sum(amount) filter (where status = 'refunded' and mode = 'live') as refunded_total,
         count(*) filter (where status in ('succeeded', 'refunded') and mode = 'live') as paid_count,
         min(paid_at) filter (where status in ('succeeded', 'refunded') and mode = 'live') as first_paid_at,
         max(paid_at) filter (where status in ('succeeded', 'refunded') and mode = 'live') as last_paid_at
  from public.payments where workspace_id = p.workspace_id
) pay on true
left join lateral (select created_at, status, provider from public.payments where workspace_id = p.workspace_id order by created_at desc limit 1) lp on true
left join lateral (select count(*) filter (where status = 'renewed') as renewals from public.subscription_events where workspace_id = p.workspace_id) se on true
left join lateral (select max(last_seen_at) as last_seen_at from public.app_sessions where user_id = p.id) s on true
left join lateral (select status, opened_at, recovered_at, payment_started_at from public.checkout_sessions where user_id = p.id order by opened_at desc limit 1) ck on true;
revoke all on public.admin_accounts_v from public, anon, authenticated;
grant select on public.admin_accounts_v to service_role;

-- ── Funnel for Admin: people who reached each stage (max stage per person) ───
create or replace function public.admin_funnel(p_since timestamptz, p_until timestamptz, p_dim text default null)
returns table (dim text, stage text, people bigint, events bigint)
language sql stable security definer set search_path = public
as $$
  with stages(name, rank) as (values
    ('plans_viewed', 1), ('plan_selected', 2), ('checkout_opened', 3), ('checkout_details', 4),
    ('payment_started', 5), ('gateway_redirected', 6), ('payment_succeeded', 7), ('subscription_activated', 8)),
  ev as (
    select e.*, s.rank,
      coalesce(e.user_id::text, case when e.visitor_id is not null then 'v:' || e.visitor_id end) as person,
      case p_dim
        when 'plan' then coalesce(e.plan, '—')
        when 'provider' then coalesce(e.provider, '—')
        when 'device' then coalesce(e.props->>'device', '—')
        when 'source' then coalesce((select pr.acquisition_source from public.profiles pr where pr.id = e.user_id), '—')
        when 'audience' then case when e.user_id is null then 'visitor' when exists (select 1 from public.workspaces w join public.profiles pr on pr.workspace_id = w.id where pr.id = e.user_id and w.trial_started_at is not null) then 'trial' else 'no_trial' end
        else 'all' end as d
    from public.funnel_events e join stages s on s.name = e.name
    where e.occurred_at >= p_since and e.occurred_at < p_until
  ),
  per_person as (select d, person, max(rank) as top from ev where person is not null group by d, person)
  select s.d, st.name,
    (select count(*) from per_person pp where pp.d = s.d and pp.top >= st.rank),
    (select count(*) from ev where ev.d = s.d and ev.name = st.name)
  from (select distinct d from ev) s cross join stages st
  order by s.d, st.rank;
$$;
revoke all on function public.admin_funnel(timestamptz, timestamptz, text) from public, anon, authenticated;

insert into public.site_settings (key, value) values ('checkout_tracking', '{"abandon_minutes": 30, "result_minutes": 120, "confirm_minutes": 1440}'::jsonb)
on conflict (key) do nothing;
-- Switches the owner can flip in Admin (payment methods etc.). Missing key = on.
insert into public.site_settings (key, value) values ('platform_switches', '{}'::jsonb) on conflict (key) do nothing;
