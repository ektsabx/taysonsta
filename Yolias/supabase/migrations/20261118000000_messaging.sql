-- Messaging & Automation (owner brief 2026-10-20, D-243).
--
-- One system for marketing and operational email, sequences, automations and
-- in-app notices, managed from Yolias Admin. It reuses what exists:
--   funnel_events  the event registry (append-only, unique event_key): the
--                  triggers below add the account, search and subscription
--                  events next to the checkout events already recorded;
--   email_log      the one send log (now also flows, campaigns and tests);
--   notifications  the in-app channel;
--   profiles / workspaces / payments / subscription_events  user state.
-- New tables hold only what the system defines and runs: templates (with
-- versions), segments, flows (automations and sequences, with versions),
-- enrollments, the activity log, campaigns, provider (Resend) events and
-- suppressions. Every table is service-role only (RLS on, no policies): the
-- Yolias worker runs the engine, Yolias Admin manages it.

-- ── email_log: the one send log ────────────────────────────────────────────
alter table public.email_log drop constraint email_log_category_check;
alter table public.email_log add constraint email_log_category_check
  check (category in ('account', 'subscription', 'billing', 'usage', 'updates', 'security', 'marketing'));
alter table public.email_log drop constraint email_log_status_check;
alter table public.email_log add constraint email_log_status_check
  check (status in ('queued', 'sent', 'skipped', 'failed', 'canceled'));
alter table public.email_log
  add column source text not null default 'system' check (source in ('system', 'flow', 'campaign', 'test')),
  -- transactional: about the account or a payment, always sent; lifecycle: onboarding and
  -- recovery, sent unless the user unsubscribed; marketing: also needs the
  -- "Product updates" opt-in (profiles.notify_product).
  add column email_class text not null default 'transactional' check (email_class in ('transactional', 'lifecycle', 'marketing')),
  add column flow_id uuid,
  add column enrollment_id uuid,
  add column step_id text,
  add column campaign_id uuid,
  add column template_id uuid,
  add column template_version int,
  -- Rendered content of a message written in Admin (kind 'custom'); the
  -- product emails keep rendering from their code templates.
  add column subject text,
  add column html text,
  add column text_body text,
  -- What Resend reported afterwards (webhook). Accepted by Resend = status 'sent';
  -- delivered / bounced / complained only when Resend says so.
  add column delivery_status text check (delivery_status in ('delivered', 'delayed', 'bounced', 'complained')),
  add column delivered_at timestamptz,
  add column opened_at timestamptz,
  add column clicked_at timestamptz,
  add column bounced_at timestamptz,
  add column complained_at timestamptz;
create index email_log_provider_idx on public.email_log (provider_id) where provider_id is not null;
create index email_log_flow_idx on public.email_log (flow_id, created_at desc) where flow_id is not null;
create index email_log_campaign_idx on public.email_log (campaign_id) where campaign_id is not null;
create index email_log_promo_idx on public.email_log (user_id, created_at desc) where email_class <> 'transactional';

alter table public.notifications
  add column source text not null default 'system' check (source in ('system', 'flow', 'campaign')),
  add column flow_id uuid,
  add column enrollment_id uuid,
  add column campaign_id uuid;
create index notifications_flow_idx on public.notifications (flow_id) where flow_id is not null;

-- Unsubscribe links (lifecycle and marketing email) carry this token, never the user id.
alter table public.profiles add column email_token uuid not null default gen_random_uuid();
alter table public.profiles add column unsubscribed_at timestamptz;
create unique index profiles_email_token_idx on public.profiles (email_token);

-- ── Templates ──────────────────────────────────────────────────────────────
create table public.msg_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text check (description is null or char_length(description) <= 500),
  category text not null default 'marketing' check (category in ('marketing', 'lifecycle', 'transactional')),
  subject text not null check (char_length(subject) between 1 and 200),
  preview_text text check (preview_text is null or char_length(preview_text) <= 200),
  html text not null check (char_length(html) between 1 and 100000),
  text_body text check (text_body is null or char_length(text_body) <= 50000),
  status text not null default 'active' check (status in ('active', 'archived')),
  version int not null default 1,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Every save keeps the previous content: a message already scheduled keeps the
-- version it was scheduled with (email_log.template_version).
create table public.msg_template_versions (
  template_id uuid not null references public.msg_templates (id) on delete cascade,
  version int not null,
  subject text not null,
  preview_text text,
  html text not null,
  text_body text,
  created_by text,
  created_at timestamptz not null default now(),
  primary key (template_id, version)
);

-- ── Segments ───────────────────────────────────────────────────────────────
create table public.msg_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text check (description is null or char_length(description) <= 500),
  -- Rules on user facts (Yolias/lib/messaging/rules.ts), all of them must hold.
  rules jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Flows: automations and sequences ───────────────────────────────────────
create table public.msg_flows (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('automation', 'sequence')),
  name text not null check (char_length(name) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  category text not null default 'marketing' check (category in ('marketing', 'lifecycle', 'transactional')),
  trigger_event text not null,
  entry_rules jsonb not null default '[]'::jsonb,
  segment_id uuid references public.msg_segments (id) on delete set null,
  steps jsonb not null default '[]'::jsonb,
  exit_events text[] not null default '{}',
  exit_rules jsonb not null default '[]'::jsonb,
  goal_event text,
  exit_on_goal boolean not null default true,
  reentry text not null default 'never' check (reentry in ('never', 'after_exit', 'always')),
  reentry_days int check (reentry_days is null or reentry_days between 1 and 3650),
  -- Sending hours in the user's time zone ({"start": 9, "end": 20}); null = any time.
  send_window jsonb,
  -- Test mode: only the test addresses below can enter, and only they receive.
  test_mode boolean not null default true,
  test_emails text[] not null default '{}',
  version int not null default 1,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz
);
create index msg_flows_trigger_idx on public.msg_flows (trigger_event) where status = 'active';
create table public.msg_flow_versions (
  flow_id uuid not null references public.msg_flows (id) on delete cascade,
  version int not null,
  definition jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  primary key (flow_id, version)
);

-- One user's way through one flow. The trigger key makes a repeated event
-- (retried webhook, double click) enter only once; the partial unique index
-- keeps one active run per user and flow.
create table public.msg_enrollments (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.msg_flows (id) on delete cascade,
  flow_version int not null,
  user_id uuid not null,
  workspace_id uuid,
  email text,
  trigger_event_id bigint,
  trigger_key text not null,
  test boolean not null default false,
  status text not null default 'active' check (status in ('active', 'completed', 'exited', 'goal_reached', 'failed')),
  current_step text,
  next_run_at timestamptz,
  locked_until timestamptz,
  attempts int not null default 0,
  entered_at timestamptz not null default now(),
  finished_at timestamptz,
  exit_reason text,
  goal_at timestamptz,
  context jsonb not null default '{}'::jsonb,
  unique (flow_id, trigger_key)
);
create unique index msg_enrollments_one_active on public.msg_enrollments (flow_id, user_id) where status = 'active';
create index msg_enrollments_due on public.msg_enrollments (next_run_at) where status = 'active';
create index msg_enrollments_user on public.msg_enrollments (user_id, status);
create index msg_enrollments_flow on public.msg_enrollments (flow_id, entered_at desc);

-- What happened, step by step, for every enrollment and campaign recipient.
create table public.msg_activity (
  id bigint generated always as identity primary key,
  enrollment_id uuid references public.msg_enrollments (id) on delete cascade,
  flow_id uuid,
  campaign_id uuid,
  user_id uuid,
  step_id text,
  kind text not null check (kind in ('entered', 'step', 'queued', 'sent', 'skipped', 'waiting', 'branch', 'notification', 'exited', 'goal', 'completed', 'error', 'retry', 'test')),
  detail text,
  data jsonb not null default '{}'::jsonb,
  email_log_id bigint,
  created_at timestamptz not null default now()
);
create index msg_activity_flow_idx on public.msg_activity (flow_id, created_at desc);
create index msg_activity_user_idx on public.msg_activity (user_id, created_at desc);
create index msg_activity_campaign_idx on public.msg_activity (campaign_id, created_at desc) where campaign_id is not null;
create index msg_activity_enrollment_idx on public.msg_activity (enrollment_id, id);
create index msg_activity_time_idx on public.msg_activity (created_at desc);

-- ── Campaigns (one-off sends to a segment) ─────────────────────────────────
create table public.msg_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  category text not null default 'marketing' check (category in ('marketing', 'lifecycle', 'transactional')),
  template_id uuid references public.msg_templates (id) on delete set null,
  template_version int,
  -- The content that is sent: copied from the template when the campaign is
  -- scheduled, so editing the template later never changes a running campaign.
  subject text not null default '' check (char_length(subject) <= 200),
  preview_text text check (preview_text is null or char_length(preview_text) <= 200),
  html text not null default '' check (char_length(html) <= 100000),
  text_body text check (text_body is null or char_length(text_body) <= 50000),
  segment_id uuid references public.msg_segments (id) on delete set null,
  audience_rules jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'canceled', 'failed')),
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  estimated int,
  recipients int not null default 0,
  skipped int not null default 0,
  -- Fan-out progress (users are paged by id).
  cursor_user uuid,
  confirmed_by text,
  test_sent_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index msg_campaigns_due on public.msg_campaigns (scheduled_at) where status in ('scheduled', 'sending');

-- ── Resend events (webhooks) and suppressions ──────────────────────────────
create table public.msg_provider_events (
  id bigint generated always as identity primary key,
  provider text not null default 'resend',
  -- svix-id: a redelivered webhook is recorded once.
  event_id text not null unique,
  type text not null,
  email_id text,
  email_log_id bigint,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create index msg_provider_events_email_idx on public.msg_provider_events (email_id);

create table public.msg_suppressions (
  email text primary key check (email = lower(email)),
  reason text not null check (reason in ('bounced', 'complained', 'unsubscribed', 'manual')),
  source text,
  created_at timestamptz not null default now()
);

alter table public.msg_templates enable row level security;
alter table public.msg_template_versions enable row level security;
alter table public.msg_segments enable row level security;
alter table public.msg_flows enable row level security;
alter table public.msg_flow_versions enable row level security;
alter table public.msg_enrollments enable row level security;
alter table public.msg_activity enable row level security;
alter table public.msg_campaigns enable row level security;
alter table public.msg_provider_events enable row level security;
alter table public.msg_suppressions enable row level security;

-- ── Events into the registry (funnel_events) ───────────────────────────────
-- Server truth only. Old rows don't produce events: nothing starts for users
-- who signed up, searched or subscribed before this migration.

create or replace function public.msg_owner(p_ws uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select created_by from public.workspaces where id = p_ws $$;

create or replace function public.msg_profile_events() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.funnel_event('user_registered:' || new.id, 'user_registered', new.id, new.workspace_id, null, null, null, null, null, true, 'server',
      jsonb_build_object('source', new.acquisition_source));
  elsif new.onboarded_at is not null and old.onboarded_at is null then
    perform public.funnel_event('onboarding_completed:' || new.id, 'onboarding_completed', new.id, new.workspace_id, null, null, null, null, null, true, 'server', '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger msg_profile_events after insert or update of onboarded_at on public.profiles
for each row execute function public.msg_profile_events();

create or replace function public.msg_search_events() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_total bigint; v_before bigint; v_m int;
begin
  if tg_table_name = 'strategies' then
    perform public.funnel_event('search_started:' || new.id, 'search_started', new.created_by, new.workspace_id, null, null, null, null, null, true, 'server',
      jsonb_build_object('search', new.id));
    return new;
  end if;
  -- campaigns: a search finished (completed or partial) for the first time.
  if new.origin is distinct from 'search' or new.status not in ('completed', 'partial') or old.status in ('completed', 'partial') then return new; end if;
  perform public.funnel_event('search_completed:' || new.id, 'search_completed', new.created_by, new.workspace_id, null, null, null, null, null, true, 'server',
    jsonb_build_object('search', new.strategy_id, 'prospects', new.prospects_found, 'status', new.status));
  if new.prospects_found > 0 then
    perform public.funnel_event('prospects_found:' || new.id, 'prospects_found', new.created_by, new.workspace_id, null, null, null, null, null, true, 'server',
      jsonb_build_object('search', new.strategy_id, 'prospects', new.prospects_found));
    -- Usage milestones: the workspace's delivered prospects crossed 10, 50, 100, 500 or 1000.
    select coalesce(sum(prospects_found), 0) into v_total from public.campaigns where workspace_id = new.workspace_id and origin = 'search' and status in ('completed', 'partial');
    v_before := v_total - new.prospects_found;
    foreach v_m in array array[10, 50, 100, 500, 1000] loop
      if v_before < v_m and v_total >= v_m then
        perform public.funnel_event('usage_milestone:' || new.workspace_id || ':' || v_m, 'usage_milestone', new.created_by, new.workspace_id, null, null, null, null, null, true, 'server',
          jsonb_build_object('milestone', v_m, 'prospects', v_total));
      end if;
    end loop;
  end if;
  return new;
end $$;
create trigger msg_search_started after insert on public.strategies
for each row execute function public.msg_search_events();
create trigger msg_search_finished after update of status on public.campaigns
for each row execute function public.msg_search_events();

-- subscription_activated is already recorded (conversion tracking, D-212).
create or replace function public.msg_subscription_events() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_name text;
begin
  v_name := case new.status
    when 'trial_started' then 'trial_started'
    when 'trial_ended' then 'trial_expired'
    when 'renewed' then 'subscription_renewed'
    when 'canceled' then 'subscription_cancelled'
    when 'ended' then 'subscription_ended'
    when 'past_due' then 'payment_overdue'
    else null end;
  if v_name is null then return new; end if;
  perform public.funnel_event(v_name || ':' || new.id, v_name, coalesce(new.created_by, public.msg_owner(new.workspace_id)), new.workspace_id, null, null,
    null, new.plan, new.billing_period, true, 'server', jsonb_build_object('mode', new.mode, 'amount', new.amount));
  return new;
end $$;
create trigger msg_subscription_events after insert on public.subscription_events
for each row execute function public.msg_subscription_events();

-- ── User facts for rules, segments and the engine ──────────────────────────
-- One row per user: account, workspace, plan, usage, activity and checkout
-- state, read fresh every time a rule is checked (never cached in the flow).
create or replace function public.msg_user_facts(p_ids uuid[])
returns table (
  user_id uuid, email text, full_name text, language text, country text, timezone text, created_at timestamptz, onboarded_at timestamptz,
  marketing_opt_in boolean, unsubscribed boolean, suppressed boolean, email_token uuid, workspace_id uuid, workspace_name text, role text, plan text, subscription_status text,
  billing_period text, trial_ends_at timestamptz, current_period_end timestamptz, cancel_at_period_end boolean,
  searches int, prospects bigint, last_seen_at timestamptz, open_checkout boolean, checkout_plan text, failed_payments_7d int, banned boolean
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.email, p.full_name, p.language, coalesce(w.billing_country, upper(p.country)), p.timezone, p.created_at, p.onboarded_at,
    p.notify_product, p.unsubscribed_at is not null, exists (select 1 from public.msg_suppressions s where s.email = lower(p.email)), p.email_token,
    w.id, w.name, m.role, w.plan, w.subscription_status, w.billing_period, w.trial_ends_at, w.current_period_end, w.cancel_at_period_end,
    (select count(*)::int from public.strategies st where st.workspace_id = w.id),
    (select coalesce(sum(c.prospects_found), 0) from public.campaigns c where c.workspace_id = w.id and c.origin = 'search'),
    (select max(a.last_seen_at) from public.app_sessions a where a.user_id = p.id),
    exists (select 1 from public.checkout_sessions cs where cs.user_id = p.id and cs.status not in ('activated', 'closed', 'paid') and cs.recovered_at is null and cs.opened_at > now() - interval '30 days'),
    (select cs.plan from public.checkout_sessions cs where cs.user_id = p.id and cs.opened_at > now() - interval '30 days' order by cs.last_activity_at desc limit 1),
    (select count(*)::int from public.payments pay where pay.workspace_id = w.id and pay.status = 'failed' and pay.created_at > now() - interval '7 days'),
    exists (select 1 from public.account_moderation am where am.user_id = p.id and am.status in ('suspended', 'banned'))
  from public.profiles p
  left join public.workspaces w on w.id = p.workspace_id
  left join public.workspace_members m on m.workspace_id = p.workspace_id and m.user_id = p.id
  where p.id = any (p_ids)
$$;

-- Users a page at a time, by id (segments, campaign fan-out).
create or replace function public.msg_user_page(p_after uuid, p_limit int)
returns table (user_id uuid)
language sql stable security definer set search_path = public
as $$
  select id from public.profiles where p_after is null or id > p_after order by id limit greatest(1, least(p_limit, 1000))
$$;

revoke all on function public.msg_user_facts(uuid[]) from public, anon, authenticated;
revoke all on function public.msg_user_page(uuid, int) from public, anon, authenticated;
revoke all on function public.msg_owner(uuid) from public, anon, authenticated;

-- ── Settings and starting drafts ───────────────────────────────────────────
insert into public.site_settings (key, value) values ('messaging', jsonb_build_object(
  'enabled', true,
  'sender_name', 'Yolias',
  'marketing_from', '',
  'reply_to', '',
  'frequency_hours', 24,
  'daily_cap', 2000,
  'campaign_confirm_over', 100,
  'inactive_days', 7,
  'stopped_days', 30,
  'trial_ending_days', 2,
  'attribution_days', 7,
  'test_emails', jsonb_build_array()
)) on conflict (key) do nothing;

-- Drafts only (status draft, test mode on): nothing is sent until an admin
-- reviews the content, turns test mode off and activates the flow.
insert into public.msg_templates (id, name, description, category, subject, preview_text, html, created_by) values
('6a1f0b8e-0001-4c3a-9a10-000000000001', 'Welcome · day 0', 'First email after signup, before a plan.', 'lifecycle',
 'Welcome to Yolias, {{first_name}}', 'Your first search takes one sentence.',
 '<p>Hi {{first_name}},</p><p>Thanks for creating your Yolias account. Yolias finds the companies and decision makers that fit what you sell, explains why each one fits, and writes first emails you approve before they go out from your own mailbox.</p><p>The fastest way to see it is one real search: describe who you sell to in a sentence, in English or Arabic.</p><p><a href="{{pricing_url}}">Choose your plan</a></p>', 'migration'),
('6a1f0b8e-0001-4c3a-9a10-000000000002', 'Welcome · day 1', 'How to write a first search.', 'lifecycle',
 'How to find your first prospects', 'Market, industry, size and the roles you want.',
 '<p>Hi {{first_name}},</p><p>A good first search names four things: the market, the industry or type of business, the company size, and the roles you want to reach. For example: "SaaS companies in Saudi Arabia with 20 to 200 employees that are hiring, and their founders."</p><p>Yolias turns it into criteria, shows you what it assumed, and returns matching companies and people with the reason each one fits.</p><p><a href="{{pricing_url}}">Get started</a></p>', 'migration'),
('6a1f0b8e-0001-4c3a-9a10-000000000003', 'Welcome · day 3', 'The value of Yolias.', 'lifecycle',
 'Spend your time on conversations, not lists', 'Yolias does the list-building part.',
 '<p>Hi {{first_name}},</p><p>Most of the time in prospecting goes into finding companies, guessing who decides and copying details into a sheet. Yolias does that part: you get the decision makers that match, the contact details that exist (missing ones are marked, never guessed), and a first email written from what your company does.</p><p>Nothing is sent without your approval, and only from your own mailbox.</p><p><a href="{{pricing_url}}">See the plans</a></p>', 'migration'),
('6a1f0b8e-0001-4c3a-9a10-000000000004', 'Welcome · day 5', 'Invitation to subscribe.', 'lifecycle',
 'Ready for your first search, {{first_name}}?', 'Every plan includes every feature.',
 '<p>Hi {{first_name}},</p><p>Every Yolias plan includes every feature and unlimited users; the plans differ only in how many prospects and emails you get each month, and you can cancel any time.</p><p><a href="{{pricing_url}}">Choose your plan</a></p>', 'migration'),
('6a1f0b8e-0001-4c3a-9a10-000000000005', 'Checkout · did something go wrong?', 'First checkout recovery email.', 'lifecycle',
 'Did something go wrong with your checkout?', 'You can pick up where you left off.',
 '<p>Hi {{first_name}},</p><p>You started subscribing to Yolias{{checkout_plan_suffix}} but the payment wasn''t completed. If something didn''t work, reply to this email and we''ll help.</p><p><a href="{{checkout_url}}">Complete your subscription</a></p>', 'migration'),
('6a1f0b8e-0001-4c3a-9a10-000000000006', 'Checkout · reminder', 'Second checkout recovery email.', 'lifecycle',
 'Your Yolias plan is one step away', 'Your checkout is saved.',
 '<p>Hi {{first_name}},</p><p>Your plan is still waiting for you. Complete the checkout to start your first search.</p><p><a href="{{checkout_url}}">Complete your subscription</a></p>', 'migration'),
('6a1f0b8e-0001-4c3a-9a10-000000000007', 'Payment failed · try again', 'After a failed payment.', 'transactional',
 'Your payment didn''t go through', 'You can try again with the same or another card.',
 '<p>Hi {{first_name}},</p><p>Your last payment for Yolias didn''t go through. You can try again with the same card or a different one.</p><p><a href="{{checkout_url}}">Try again</a></p><p>If it keeps failing, reply to this email and our team will help.</p>', 'migration'),
('6a1f0b8e-0001-4c3a-9a10-000000000008', 'Trial ending soon', 'Before the free trial ends.', 'transactional',
 'Your Yolias trial ends on {{trial_ends}}', 'Your searches and prospects stay saved.',
 '<p>Hi {{first_name}},</p><p>Your free trial ends on {{trial_ends}}. Your plan continues after that; your searches and prospects stay saved either way.</p><p><a href="{{app_url}}">Open Yolias</a></p>', 'migration')
on conflict (id) do nothing;
insert into public.msg_template_versions (template_id, version, subject, preview_text, html, created_by)
select id, 1, subject, preview_text, html, 'migration' from public.msg_templates where created_by = 'migration'
on conflict do nothing;

insert into public.msg_flows (id, kind, name, description, status, category, trigger_event, entry_rules, steps, exit_events, goal_event, reentry, created_by) values
('7b2e0c9f-0001-4d4b-8b20-000000000001', 'sequence', 'Welcome · new accounts without a plan',
 'Day 0, 1, 3 and 5 after signup. Stops as soon as the user subscribes.', 'draft', 'lifecycle', 'user_registered',
 '[{"field":"has_plan","op":"is","value":false}]'::jsonb,
 '[{"id":"d0","type":"email","template_id":"6a1f0b8e-0001-4c3a-9a10-000000000001"},
   {"id":"w1","type":"wait","amount":1,"unit":"days"},
   {"id":"d1","type":"email","template_id":"6a1f0b8e-0001-4c3a-9a10-000000000002"},
   {"id":"w3","type":"wait","amount":2,"unit":"days"},
   {"id":"d3","type":"email","template_id":"6a1f0b8e-0001-4c3a-9a10-000000000003"},
   {"id":"w5","type":"wait","amount":2,"unit":"days"},
   {"id":"d5","type":"email","template_id":"6a1f0b8e-0001-4c3a-9a10-000000000004"}]'::jsonb,
 array['subscription_activated', 'trial_started'], 'subscription_activated', 'never', 'migration'),
('7b2e0c9f-0001-4d4b-8b20-000000000002', 'sequence', 'Checkout recovery',
 'After an abandoned checkout: a check-in, then a reminder. Never after a confirmed payment.', 'draft', 'lifecycle', 'checkout_abandoned',
 '[{"field":"has_plan","op":"is","value":false}]'::jsonb,
 '[{"id":"w0","type":"wait","amount":1,"unit":"hours"},
   {"id":"e1","type":"email","template_id":"6a1f0b8e-0001-4c3a-9a10-000000000005"},
   {"id":"w1","type":"wait","amount":1,"unit":"days"},
   {"id":"b1","type":"branch","rules":[{"field":"open_checkout","op":"is","value":true}],"yes":"e2","no":"end"},
   {"id":"e2","type":"email","template_id":"6a1f0b8e-0001-4c3a-9a10-000000000006"}]'::jsonb,
 array['subscription_activated', 'payment_succeeded', 'trial_started'], 'subscription_activated', 'after_exit', 'migration'),
('7b2e0c9f-0001-4d4b-8b20-000000000003', 'automation', 'Payment failed · try again',
 'One email after a failed payment, then stops if payments keep failing (support takes over).', 'draft', 'transactional', 'payment_failed',
 '[{"field":"has_plan","op":"is","value":false},{"field":"failed_payments_7d","op":"lte","value":3}]'::jsonb,
 '[{"id":"w0","type":"wait","amount":30,"unit":"minutes"},
   {"id":"e1","type":"email","template_id":"6a1f0b8e-0001-4c3a-9a10-000000000007"}]'::jsonb,
 array['payment_succeeded', 'subscription_activated'], 'subscription_activated', 'after_exit', 'migration'),
('7b2e0c9f-0001-4d4b-8b20-000000000004', 'automation', 'Trial ending soon',
 'An email and an in-app notice before the free trial ends.', 'draft', 'transactional', 'trial_ending_soon',
 '[{"field":"subscription_status","op":"in","value":["trialing"]}]'::jsonb,
 '[{"id":"e1","type":"email","template_id":"6a1f0b8e-0001-4c3a-9a10-000000000008"},
   {"id":"n1","type":"notification","title":"Your free trial ends on {{trial_ends}}","body":"Your plan continues after that. Your searches and prospects stay saved.","link":"/checkout"}]'::jsonb,
 array['subscription_cancelled'], null, 'always', 'migration')
on conflict (id) do nothing;
insert into public.msg_flow_versions (flow_id, version, definition, created_by)
select id, 1, jsonb_build_object('trigger_event', trigger_event, 'entry_rules', entry_rules, 'steps', steps, 'exit_events', exit_events, 'goal_event', goal_event), 'migration'
from public.msg_flows where created_by = 'migration'
on conflict do nothing;

-- ── Engine helpers ─────────────────────────────────────────────────────────
-- Claims due enrollments for one worker call (two workers never run the same
-- step: the row is locked for two minutes while it runs).
create or replace function public.msg_claim_due(p_limit int)
returns setof public.msg_enrollments
language sql security definer set search_path = public
as $$
  update public.msg_enrollments e set locked_until = now() + interval '2 minutes'
  where e.id in (
    select id from public.msg_enrollments
    where status = 'active' and next_run_at <= now() and (locked_until is null or locked_until < now())
    order by next_run_at limit greatest(1, least(p_limit, 200))
    for update skip locked
  )
  returning e.*
$$;

-- Time-based events: inactive (no app session for p_days), stopped using
-- (p_stopped_days), returned (a session after an inactive event), trial
-- ending (p_trial_days left). Each has a unique key, so running this again
-- records nothing twice. Returns how many events were written.
create or replace function public.msg_time_events(p_days int, p_stopped_days int, p_trial_days int)
returns int
language plpgsql security definer set search_path = public
as $$
declare n int := 0; k int;
begin
  with last as (
    select p.id as user_id, p.workspace_id, coalesce((select max(a.last_seen_at) from public.app_sessions a where a.user_id = p.id), p.created_at) as seen
    from public.profiles p
  )
  insert into public.funnel_events (event_key, name, user_id, workspace_id, confirmed, source, props)
  select 'user_inactive:' || user_id || ':' || to_char(seen, 'YYYYMMDDHH24MI'), 'user_inactive', user_id, workspace_id, true, 'worker', jsonb_build_object('days', p_days)
  from last where seen < now() - make_interval(days => p_days) and seen > now() - make_interval(days => p_days + 30)
  on conflict (event_key) do nothing;
  get diagnostics k = row_count; n := n + k;

  with last as (
    select p.id as user_id, p.workspace_id, coalesce((select max(a.last_seen_at) from public.app_sessions a where a.user_id = p.id), p.created_at) as seen
    from public.profiles p
  )
  insert into public.funnel_events (event_key, name, user_id, workspace_id, confirmed, source, props)
  select 'user_stopped_using:' || user_id || ':' || to_char(seen, 'YYYYMMDDHH24MI'), 'user_stopped_using', user_id, workspace_id, true, 'worker', jsonb_build_object('days', p_stopped_days)
  from last where seen < now() - make_interval(days => p_stopped_days) and seen > now() - make_interval(days => p_stopped_days + 30)
  on conflict (event_key) do nothing;
  get diagnostics k = row_count; n := n + k;

  insert into public.funnel_events (event_key, name, user_id, workspace_id, confirmed, source, props)
  select 'user_returned:' || e.id, 'user_returned', e.user_id, e.workspace_id, true, 'worker',
    jsonb_build_object('days_away', extract(day from now() - e.occurred_at)::int + coalesce((e.props->>'days')::int, 0))
  from public.funnel_events e
  where e.name = 'user_inactive' and e.occurred_at > now() - interval '120 days'
    and exists (select 1 from public.app_sessions a where a.user_id = e.user_id and a.last_seen_at > e.occurred_at)
  on conflict (event_key) do nothing;
  get diagnostics k = row_count; n := n + k;

  insert into public.funnel_events (event_key, name, user_id, workspace_id, plan, confirmed, source, props)
  select 'trial_ending_soon:' || w.id || ':' || to_char(w.trial_ends_at, 'YYYYMMDD'), 'trial_ending_soon', w.created_by, w.id, w.plan, true, 'worker',
    jsonb_build_object('days_left', greatest(0, ceil(extract(epoch from w.trial_ends_at - now()) / 86400))::int)
  from public.workspaces w
  where w.subscription_status = 'trialing' and w.trial_ends_at > now() and w.trial_ends_at <= now() + make_interval(days => p_trial_days)
  on conflict (event_key) do nothing;
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

revoke all on function public.msg_claim_due(int) from public, anon, authenticated;
revoke all on function public.msg_time_events(int, int, int) from public, anon, authenticated;
