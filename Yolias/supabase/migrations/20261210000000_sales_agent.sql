-- Yolias as an AI sales agent (owner, 2026-10-31, D-273). Additive only.
--  1. Meetings: confirmed_at (the guest chose or accepted the time). Bookings
--     from the booking page and times the lead named in the thread are
--     confirmed when made; Google Calendar acceptances confirm the rest.
--  2. Workspace daily budget (USD): no new search work starts on a day the
--     workspace already spent it.
--  3. Campaign "message" level: the sender's name and notes for Yolias.
--  4. Notifications: four new preferences, on by default; product updates on
--     by default for new members (existing members keep their choice).
--  5. Referrals: a "review" status (held for Yolias Admin) and the decision.
--  6. Lookalike audiences: expansion level, seed size and confidence.
--  7. Learning: one row of insights per workspace, rebuilt daily from its own
--     results (numbers and short phrases only, never message bodies).
--  8. Campaign activity: kinds for what the agent did.

-- 1. Meetings
alter table public.sales_meetings add column if not exists confirmed_at timestamptz;
update public.sales_meetings set confirmed_at = created_at where confirmed_at is null and source in ('booking', 'agent');

-- 2. Workspace daily budget
alter table public.workspaces add column if not exists daily_budget_usd numeric(10,2) check (daily_budget_usd is null or (daily_budget_usd >= 0 and daily_budget_usd <= 100000));

-- 3. Campaign message level
alter table public.outreach_campaigns add column if not exists sender_name text check (sender_name is null or length(sender_name) <= 120);
alter table public.outreach_campaigns add column if not exists instructions text check (instructions is null or length(instructions) <= 2000);

-- 4. Notifications
alter table public.profiles add column if not exists notify_review boolean not null default true;
alter table public.profiles add column if not exists notify_daily_changes boolean not null default true;
alter table public.profiles add column if not exists notify_daily_summary boolean not null default true;
alter table public.profiles add column if not exists notify_founder boolean not null default true;
alter table public.profiles alter column notify_product set default true;

-- 5. Referrals
alter table public.referrals drop constraint if exists referrals_status_check;
alter table public.referrals add constraint referrals_status_check check (status in ('rewarded', 'capped', 'rejected', 'review'));
alter table public.referrals add column if not exists signals jsonb not null default '[]'::jsonb;
alter table public.referrals add column if not exists decided_at timestamptz;
alter table public.referrals add column if not exists decided_by text;
create index if not exists referrals_signup_ip on public.referrals (signup_ip) where signup_ip is not null;

-- 6. Lookalike audiences
alter table public.audiences add column if not exists expansion smallint check (expansion is null or expansion between 1 and 10);
alter table public.audiences add column if not exists seed_size integer check (seed_size is null or seed_size >= 0);
alter table public.audiences add column if not exists confidence text check (confidence is null or confidence in ('low', 'medium', 'high'));

-- 7. Learning
create table if not exists public.workspace_insights (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);
alter table public.workspace_insights enable row level security;
drop policy if exists "members read insights" on public.workspace_insights;
create policy "members read insights" on public.workspace_insights for select using (public.is_workspace_member(workspace_id));

-- 8. Campaign activity kinds
alter table public.campaign_activity drop constraint if exists campaign_activity_kind_check;
alter table public.campaign_activity add constraint campaign_activity_kind_check check (kind in ('started', 'scheduled', 'paused', 'resumed', 'completed', 'failed', 'guard', 'enrolled', 'angle', 'pace', 'note', 'found', 'replied', 'meeting', 'handoff', 'learned'));

-- 9. The old per-campaign approval cards (D-253) are gone: launching a campaign is the go-ahead.
update public.agent_pending_actions set status = 'expired' where tool = 'startOutreachCampaign' and status = 'pending';

-- 10. Yolias AI opened from a page (D-273): the page it was opened from, so "this campaign" means it.
alter table public.strategies add column if not exists page_context text check (page_context is null or length(page_context) <= 300);
