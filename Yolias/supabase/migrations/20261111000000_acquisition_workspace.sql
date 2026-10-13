-- Customer acquisition after discovery (owner brief 2026-10-13, D-193..D-199):
-- signup source, welcome video, CRM (leads, stages, timeline, tasks,
-- meetings), Outreach campaigns (steps, enrollments) on the existing
-- outreach_messages, a unified Inbox (one thread per lead), and the AI
-- Workspace (Company Knowledge + offers + competitors, Customer Profiles,
-- agent settings / permissions / limits / escalation, Automations + runs).
--
-- Entities, not pages: one lead per real person or company in a workspace
-- (lead_key), referenced by campaigns, messages, threads, meetings, tasks and
-- the timeline. Three separate states: message status (outreach_messages),
-- conversation status (inbox_threads) and deal stage (leads.stage).
-- Yolias still sends nothing by itself: no mailbox integration is connected
-- (D-155), so a message becomes "sent" only when the member confirms they sent
-- it from their own app, and replies exist only when logged by the member.

-- ── helpers ──────────────────────────────────────────────────────────────────
create or replace function public.is_workspace_manager(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid() and m.role in ('owner', 'admin'));
$$;
revoke execute on function public.is_workspace_manager(uuid) from public, anon;
grant execute on function public.is_workspace_manager(uuid) to authenticated, service_role;

-- ── 1. Signup source + welcome video state (per user) ───────────────────────
alter table public.profiles
  add column acquisition_source text check (acquisition_source is null or acquisition_source in (
    'google', 'youtube', 'tiktok', 'friend', 'x', 'instagram', 'review_site', 'blog', 'facebook',
    'ai_chat', 'linkedin', 'email', 'reddit', 'podcast', 'other', 'prefer_not_to_say')),
  add column acquisition_source_other text check (acquisition_source_other is null or length(acquisition_source_other) between 1 and 120),
  add column acquisition_answered_at timestamptz,
  add column welcome_video_seen_at timestamptz,
  add constraint profiles_acquisition_other_check check (acquisition_source_other is null or acquisition_source = 'other');
comment on column public.profiles.acquisition_source is 'How Did You Find Us? (onboarding). NULL = not answered (users onboarded before the question existed are never forced).';
-- The answer is written once by the server (onboarding); the welcome video state by the user.
grant update (welcome_video_seen_at) on public.profiles to authenticated;
-- profiles has a table-wide update grant: the answer is protected by a trigger instead.
create or replace function public.profiles_protect_acquisition() returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' and (new.acquisition_source is distinct from old.acquisition_source
      or new.acquisition_source_other is distinct from old.acquisition_source_other
      or new.acquisition_answered_at is distinct from old.acquisition_answered_at) then
    raise exception 'acquisition source is written by the server';
  end if;
  return new;
end $$;
create trigger profiles_protect_acquisition before update on public.profiles for each row execute function public.profiles_protect_acquisition();

-- Admin: sign-ups per source (service role only).
create or replace function public.acquisition_sources() returns table (source text, users bigint, last_30_days bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(acquisition_source, 'not_answered'), count(*), count(*) filter (where created_at >= now() - interval '30 days')
  from public.profiles group by 1 order by 2 desc;
$$;
revoke execute on function public.acquisition_sources() from public, anon, authenticated;
grant execute on function public.acquisition_sources() to service_role;

-- Welcome video defaults (Admin → Platform → Onboarding edits it; Yolias reads it live).
insert into public.site_settings (key, value) values
  ('yolias_welcome_video', '{"enabled": false, "url": "", "title": "", "description": ""}'::jsonb)
on conflict (key) do nothing;

-- ── 2. Company Knowledge (one row per workspace) + offers + competitors ─────
-- The basic company profile stays on workspaces (name, website, industry,
-- offering, ideal_customer, target_markets): moved in the UI, not copied.
create table public.workspace_knowledge (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  about text check (about is null or length(about) <= 4000),
  services text check (services is null or length(services) <= 4000),
  products text check (products is null or length(products) <= 4000),
  pricing text check (pricing is null or length(pricing) <= 4000),
  differentiators text check (differentiators is null or length(differentiators) <= 4000),
  case_studies text check (case_studies is null or length(case_studies) <= 6000),
  faqs text check (faqs is null or length(faqs) <= 6000),
  reply_policy text check (reply_policy is null or length(reply_policy) <= 4000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.business_offers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  description text check (description is null or length(description) <= 3000),
  problem text check (problem is null or length(problem) <= 2000),
  audience text check (audience is null or length(audience) <= 2000),
  benefits text check (benefits is null or length(benefits) <= 2000),
  price text check (price is null or length(price) <= 300),
  terms text check (terms is null or length(terms) <= 2000),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index business_offers_name_uq on public.business_offers (workspace_id, lower(trim(name)));

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  website text check (website is null or length(website) <= 300),
  description text check (description is null or length(description) <= 3000),
  strengths text check (strengths is null or length(strengths) <= 3000),
  -- Only weaknesses / gaps the member verified (the AI never invents them).
  weaknesses text check (weaknesses is null or length(weaknesses) <= 3000),
  differences text check (differences is null or length(differences) <= 3000),
  notes text check (notes is null or length(notes) <= 3000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index competitors_name_uq on public.competitors (workspace_id, lower(trim(name)));

-- ── 3. Customer Profiles (several per workspace) ─────────────────────────────
create table public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  is_default boolean not null default false,
  problems text check (problems is null or length(problems) <= 3000),
  benefits text check (benefits is null or length(benefits) <= 3000),
  usp text check (usp is null or length(usp) <= 2000),
  goals text check (goals is null or length(goals) <= 3000),
  success_stories text check (success_stories is null or length(success_stories) <= 4000),
  include_keywords text[] not null default '{}' check (cardinality(include_keywords) <= 50),
  exclude_keywords text[] not null default '{}' check (cardinality(exclude_keywords) <= 50),
  industries text[] not null default '{}' check (cardinality(industries) <= 30),
  company_size_min int check (company_size_min is null or company_size_min >= 0),
  company_size_max int check (company_size_max is null or company_size_max >= 0),
  job_titles text[] not null default '{}' check (cardinality(job_titles) <= 30),
  countries text[] not null default '{}' check (cardinality(countries) <= 50),
  regions text check (regions is null or length(regions) <= 300),
  budget text check (budget is null or length(budget) <= 300),
  customer_type text not null default 'b2b' check (customer_type in ('b2b', 'b2c', 'both')),
  extra_criteria text check (extra_criteria is null or length(extra_criteria) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (company_size_min is null or company_size_max is null or company_size_min <= company_size_max)
);
create unique index customer_profiles_name_uq on public.customer_profiles (workspace_id, lower(trim(name)));
create unique index customer_profiles_default_uq on public.customer_profiles (workspace_id) where is_default;

alter table public.strategies add column customer_profile_id uuid references public.customer_profiles(id) on delete set null;

-- ── 4. CRM: leads, timeline, tasks, meetings ─────────────────────────────────
create table public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- One lead per real person / company: email or shared person id for people,
  -- domain or shared company id for companies (adding again never duplicates).
  lead_key text not null,
  prospect_id uuid references public.prospects(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  -- Kept so the history stays readable if the search result is deleted.
  name text not null check (length(name) between 1 and 300),
  company_name text check (company_name is null or length(company_name) <= 300),
  email text check (email is null or length(email) <= 320),
  stage text not null default 'new' check (stage in ('new', 'interested', 'meeting_booked', 'meeting_completed', 'closed', 'lost')),
  stage_changed_at timestamptz not null default now(),
  owner_id uuid references auth.users(id) on delete set null,
  deal_value numeric(14, 2) check (deal_value is null or deal_value >= 0),
  deal_currency text not null default 'USD' check (deal_currency ~ '^[A-Z]{3}$'),
  source text not null default 'search' check (source in ('search', 'import', 'manual')),
  customer_profile_id uuid references public.customer_profiles(id) on delete set null,
  -- The person asked not to be contacted again: honoured everywhere.
  do_not_contact boolean not null default false,
  next_follow_up_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, lead_key)
);
create index sales_leads_ws_stage_idx on public.sales_leads (workspace_id, stage, last_activity_at desc);
create index sales_leads_prospect_idx on public.sales_leads (prospect_id);
create index sales_leads_company_idx on public.sales_leads (company_id);

create table public.lead_activities (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  kind text not null check (kind in (
    'created', 'stage_changed', 'note', 'deal_updated', 'message_drafted', 'message_sent', 'reply_logged', 'reply_analyzed',
    'meeting_scheduled', 'meeting_updated', 'task_created', 'task_done', 'enrolled', 'enrollment_stopped', 'automation', 'agent', 'do_not_contact')),
  actor_id uuid references auth.users(id) on delete set null,
  actor_kind text not null default 'user' check (actor_kind in ('user', 'agent', 'automation', 'system')),
  body text check (body is null or length(body) <= 4000),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);
create index lead_activities_ws_idx on public.lead_activities (workspace_id, created_at desc);

create table public.lead_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 300),
  kind text not null default 'reminder' check (kind in ('reminder', 'follow_up', 'meeting_prep', 'review', 'approval')),
  due_at timestamptz,
  done_at timestamptz,
  assignee_id uuid references auth.users(id) on delete set null,
  source text not null default 'user' check (source in ('user', 'agent', 'automation')),
  -- Same reminder never created twice (follow-up sweep, automations).
  dedupe_key text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lead_tasks_open_idx on public.lead_tasks (workspace_id, due_at) where done_at is null;
create index lead_tasks_lead_idx on public.lead_tasks (lead_id);
create unique index lead_tasks_dedupe_uq on public.lead_tasks (workspace_id, dedupe_key) where dedupe_key is not null;

create table public.sales_meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz,
  url text check (url is null or (length(url) <= 1000 and url ~* '^https?://')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'canceled', 'no_show')),
  notes text check (notes is null or length(notes) <= 6000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index sales_meetings_lead_idx on public.sales_meetings (lead_id, starts_at);
create index sales_meetings_ws_idx on public.sales_meetings (workspace_id, starts_at) where status = 'scheduled';

-- ── 5. Outreach campaigns, steps, enrollments ────────────────────────────────
-- Separate from discovery campaigns (public.campaigns = searches).
create table public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  goal text check (goal is null or length(goal) <= 1000),
  description text check (description is null or length(description) <= 3000),
  channel text not null default 'email' check (channel in ('email', 'linkedin', 'whatsapp', 'facebook', 'instagram')),
  language text not null default 'en' check (language ~ '^[a-z]{2,3}$'),
  tone text not null default 'direct' check (tone in ('conservative', 'direct', 'friendly')),
  customer_profile_id uuid references public.customer_profiles(id) on delete set null,
  offer_id uuid references public.business_offers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outreach_campaigns_ws_idx on public.outreach_campaigns (workspace_id, status, updated_at desc);

create table public.outreach_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  position int not null check (position between 1 and 10),
  delay_days int not null default 0 check (delay_days between 0 and 90),
  objective text not null default 'introduction' check (objective in ('introduction', 'sales', 'meeting', 'follow_up', 'partnership', 'referral')),
  instruction text check (instruction is null or length(instruction) <= 1000),
  unique (campaign_id, position)
);

create table public.outreach_enrollments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'replied', 'completed', 'stopped')),
  -- Last step whose message was sent (0 = nothing sent yet).
  current_step int not null default 0 check (current_step between 0 and 10),
  next_step_at timestamptz,
  stop_reason text check (stop_reason is null or length(stop_reason) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);
create index outreach_enrollments_due_idx on public.outreach_enrollments (next_step_at) where status = 'active';
create index outreach_enrollments_lead_idx on public.outreach_enrollments (lead_id);

-- Messages: the same table as the prospect actions, now tied to the lead,
-- the outreach campaign / step, a direction and a planned send time.
alter table public.outreach_messages
  add column lead_id uuid references public.sales_leads(id) on delete set null,
  add column outreach_campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  add column enrollment_id uuid references public.outreach_enrollments(id) on delete set null,
  add column step_position int check (step_position is null or step_position between 1 and 10),
  add column direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  add column scheduled_for timestamptz,
  add column sent_via text check (sent_via is null or sent_via in ('manual', 'mailbox')),
  add column from_address text check (from_address is null or length(from_address) <= 320),
  add column received_at timestamptz,
  add column analysis jsonb;
alter table public.outreach_messages drop constraint outreach_messages_status_check;
alter table public.outreach_messages add constraint outreach_messages_status_check
  check (status in ('draft', 'approved', 'sending', 'sent', 'failed', 'canceled', 'received'));
alter table public.outreach_messages add constraint outreach_messages_direction_status_check
  check ((direction = 'inbound') = (status = 'received'));
alter table public.outreach_messages drop constraint outreach_messages_target_check;
alter table public.outreach_messages add constraint outreach_messages_target_check
  check (prospect_id is not null or company_id is not null or lead_id is not null);
-- One prepared message per enrollment step (the follow-up sweep is idempotent).
create unique index outreach_messages_step_uq on public.outreach_messages (enrollment_id, step_position)
  where enrollment_id is not null and direction = 'outbound' and status <> 'canceled';
create index outreach_messages_lead_idx on public.outreach_messages (lead_id, created_at);
create index outreach_messages_scheduled_idx on public.outreach_messages (workspace_id, scheduled_for) where scheduled_for is not null and status in ('draft', 'approved');

-- ── 6. Inbox: one conversation per lead ──────────────────────────────────────
create table public.inbox_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null unique references public.sales_leads(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'done', 'other')),
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inbox_threads_ws_idx on public.inbox_threads (workspace_id, last_message_at desc nulls last);

-- ── 7. AI Workspace settings: agents, permissions, limits, escalation ──────
-- Validated by the server (lib/ai-workspace/settings.ts); missing keys use
-- the safe defaults in code. Enforced by every server action and agent.
create table public.workspace_ai_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  agents jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  escalation jsonb not null default '{}'::jsonb,
  guidelines text check (guidelines is null or length(guidelines) <= 6000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Agent actions waiting for the member's approval (Rules & Permissions → "Needs approval").
alter table public.agent_pending_actions
  add column lead_id uuid references public.sales_leads(id) on delete cascade,
  add column agent text check (agent is null or agent in ('research', 'outreach', 'replies', 'follow_up', 'meeting', 'crm', 'automation'));
create index agent_pending_actions_ws_idx on public.agent_pending_actions (workspace_id, status, created_at desc);

-- ── 8. Automations + run log ─────────────────────────────────────────────────
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  trigger text not null check (trigger in ('lead.created', 'lead.stage_changed', 'meeting.booked', 'meeting.completed', 'reply.received', 'enrollment.finished')),
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) between 1 and 5),
  enabled boolean not null default true,
  -- Deleting keeps the run history (soft delete).
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index automations_ws_idx on public.automations (workspace_id, trigger) where deleted_at is null and enabled;

create table public.automation_runs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  -- The event that fired it ("activity:123"): the same event never runs twice.
  event_key text not null,
  trigger text not null,
  lead_id uuid references public.sales_leads(id) on delete set null,
  status text not null check (status in ('succeeded', 'partial', 'failed', 'skipped', 'needs_approval')),
  results jsonb not null default '[]'::jsonb,
  error text check (error is null or length(error) <= 1000),
  created_at timestamptz not null default now(),
  unique (automation_id, event_key)
);
create index automation_runs_ws_idx on public.automation_runs (workspace_id, created_at desc);

-- ── updated_at triggers ──────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['business_offers', 'competitors', 'customer_profiles', 'sales_leads', 'lead_tasks', 'sales_meetings',
    'outreach_campaigns', 'outreach_enrollments', 'inbox_threads', 'automations'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- ── lead identity ────────────────────────────────────────────────────────────
-- (Tables are sales_leads / sales_meetings: the shared production database
-- already has the Admin's own leads and meetings tables.)
-- Adds a search result (person or company) to the CRM, or returns the lead it
-- already is. Definer so it can link identities, but only for a member of the
-- result's workspace (checked below); the service role passes through.
create or replace function public.upsert_lead(p_prospect uuid, p_company uuid, p_source text default 'search')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid; v_key text; v_name text; v_company_name text; v_email text; v_company uuid; v_id uuid;
begin
  if (p_prospect is null) = (p_company is null) then raise exception 'one target'; end if;
  if p_source not in ('search', 'import', 'manual') then raise exception 'bad source'; end if;
  if p_prospect is not null then
    select p.workspace_id, p.full_name, co.name, nullif(lower(trim(p.email)), ''), p.company_id,
           case when nullif(trim(p.email), '') is not null and coalesce(p.email_status, '') <> 'invalid' then 'email:' || lower(trim(p.email))
                when p.person_id is not null then 'person:' || p.person_id
                else 'prospect:' || p.id end
      into v_ws, v_name, v_company_name, v_email, v_company, v_key
      from public.prospects p left join public.companies co on co.id = p.company_id where p.id = p_prospect;
  else
    select c.workspace_id, c.name, c.name, nullif(lower(trim(c.email)), ''), c.id,
           case when nullif(trim(c.domain), '') is not null then 'domain:' || lower(regexp_replace(trim(c.domain), '^www\.', ''))
                when c.intel_company_id is not null then 'company:' || c.intel_company_id
                else 'companyrow:' || c.id end
      into v_ws, v_name, v_company_name, v_email, v_company, v_key
      from public.companies c where c.id = p_company;
  end if;
  if v_ws is null then raise exception 'not found'; end if;
  if auth.role() <> 'service_role' and not public.is_workspace_member(v_ws) then raise exception 'not found'; end if;

  insert into public.sales_leads (workspace_id, lead_key, prospect_id, company_id, name, company_name, email, source, created_by)
  values (v_ws, v_key, p_prospect, v_company, coalesce(nullif(trim(v_name), ''), v_company_name, 'Unknown'), v_company_name, v_email, p_source, auth.uid())
  on conflict (workspace_id, lead_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.sales_leads where workspace_id = v_ws and lead_key = v_key;
    -- A person found later for a company lead (or vice versa) fills the gap, never replaces.
    update public.sales_leads set prospect_id = coalesce(prospect_id, p_prospect), company_id = coalesce(company_id, v_company)
      where id = v_id and (prospect_id is null or company_id is null);
  end if;
  return v_id;
end $$;
revoke execute on function public.upsert_lead(uuid, uuid, text) from public, anon;
grant execute on function public.upsert_lead(uuid, uuid, text) to authenticated, service_role;

-- ── timeline triggers ────────────────────────────────────────────────────────
-- Who did it: the signed-in member, or what the server says (app.actor_kind).
create or replace function public.current_actor_kind() returns text language sql stable as $$
  select coalesce(nullif(current_setting('app.actor_kind', true), ''), case when auth.uid() is null then 'system' else 'user' end);
$$;

create or replace function public.leads_timeline() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_activities (workspace_id, lead_id, kind, actor_id, actor_kind, meta)
    values (new.workspace_id, new.id, 'created', auth.uid(), public.current_actor_kind(), jsonb_build_object('source', new.source));
    insert into public.inbox_threads (workspace_id, lead_id) values (new.workspace_id, new.id) on conflict (lead_id) do nothing;
    return new;
  end if;
  if new.stage is distinct from old.stage then
    insert into public.lead_activities (workspace_id, lead_id, kind, actor_id, actor_kind, meta)
    values (new.workspace_id, new.id, 'stage_changed', auth.uid(), public.current_actor_kind(), jsonb_build_object('from', old.stage, 'to', new.stage));
    -- Lost or closed: active follow-ups stop (never re-contacted automatically).
    if new.stage in ('lost', 'closed') then
      update public.outreach_enrollments set status = 'stopped', stop_reason = 'stage_' || new.stage, next_step_at = null
        where lead_id = new.id and status in ('active', 'paused');
    end if;
  end if;
  if new.deal_value is distinct from old.deal_value or new.deal_currency is distinct from old.deal_currency then
    insert into public.lead_activities (workspace_id, lead_id, kind, actor_id, actor_kind, meta)
    values (new.workspace_id, new.id, 'deal_updated', auth.uid(), public.current_actor_kind(), jsonb_build_object('value', new.deal_value, 'currency', new.deal_currency));
  end if;
  if new.do_not_contact and not old.do_not_contact then
    insert into public.lead_activities (workspace_id, lead_id, kind, actor_id, actor_kind)
    values (new.workspace_id, new.id, 'do_not_contact', auth.uid(), public.current_actor_kind());
    update public.outreach_enrollments set status = 'stopped', stop_reason = 'do_not_contact', next_step_at = null
      where lead_id = new.id and status in ('active', 'paused');
    update public.outreach_messages set status = 'canceled' where lead_id = new.id and direction = 'outbound' and status in ('draft', 'approved');
  end if;
  return new;
end $$;
create or replace function public.leads_stage_stamp() returns trigger language plpgsql as $$
begin
  if new.stage is distinct from old.stage then new.stage_changed_at := now(); end if;
  -- Once asked to stop, the flag can't be cleared by an agent or automation.
  if old.do_not_contact and not new.do_not_contact and public.current_actor_kind() <> 'user' then new.do_not_contact := true; end if;
  return new;
end $$;
create trigger sales_leads_stage_stamp before update on public.sales_leads for each row execute function public.leads_stage_stamp();
create trigger sales_leads_timeline after insert or update on public.sales_leads for each row execute function public.leads_timeline();

create or replace function public.lead_activity_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.sales_leads set last_activity_at = new.created_at where id = new.lead_id and last_activity_at < new.created_at;
  return new;
end $$;
create trigger lead_activity_touch after insert on public.lead_activities for each row execute function public.lead_activity_touch();

-- Next follow-up = earliest open task with a due date.
create or replace function public.lead_tasks_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_lead uuid := coalesce(new.lead_id, old.lead_id);
begin
  update public.sales_leads set next_follow_up_at = (select min(due_at) from public.lead_tasks where lead_id = v_lead and done_at is null and due_at is not null)
    where id = v_lead;
  if tg_op = 'INSERT' then
    insert into public.lead_activities (workspace_id, lead_id, kind, actor_id, actor_kind, body, meta)
    values (new.workspace_id, new.lead_id, 'task_created', auth.uid(), case when new.source = 'user' then public.current_actor_kind() else new.source end, new.title, jsonb_build_object('task_id', new.id, 'due_at', new.due_at, 'kind', new.kind));
  elsif tg_op = 'UPDATE' and new.done_at is not null and old.done_at is null then
    insert into public.lead_activities (workspace_id, lead_id, kind, actor_id, actor_kind, body, meta)
    values (new.workspace_id, new.lead_id, 'task_done', auth.uid(), public.current_actor_kind(), new.title, jsonb_build_object('task_id', new.id));
  end if;
  return coalesce(new, old);
end $$;
create trigger lead_tasks_sync after insert or update or delete on public.lead_tasks for each row execute function public.lead_tasks_sync();

create or replace function public.meetings_timeline() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.lead_activities (workspace_id, lead_id, kind, actor_id, actor_kind, body, meta)
  values (new.workspace_id, new.lead_id, case when tg_op = 'INSERT' then 'meeting_scheduled' else 'meeting_updated' end,
          auth.uid(), public.current_actor_kind(), new.title,
          jsonb_build_object('meeting_id', new.id, 'starts_at', new.starts_at, 'status', new.status, 'from_status', case when tg_op = 'UPDATE' then old.status end));
  return new;
end $$;
create trigger sales_meetings_timeline after insert or update of status, starts_at, title on public.sales_meetings for each row execute function public.meetings_timeline();

create or replace function public.enrollments_timeline() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select name into v_name from public.outreach_campaigns where id = new.campaign_id;
  if tg_op = 'INSERT' then
    insert into public.lead_activities (workspace_id, lead_id, kind, actor_id, actor_kind, body, meta)
    values (new.workspace_id, new.lead_id, 'enrolled', auth.uid(), public.current_actor_kind(), v_name, jsonb_build_object('campaign_id', new.campaign_id));
  elsif new.status in ('stopped', 'completed') and old.status not in ('stopped', 'completed') then
    insert into public.lead_activities (workspace_id, lead_id, kind, actor_id, actor_kind, body, meta)
    values (new.workspace_id, new.lead_id, 'enrollment_stopped', auth.uid(), public.current_actor_kind(), v_name,
            jsonb_build_object('campaign_id', new.campaign_id, 'status', new.status, 'reason', new.stop_reason));
  end if;
  return new;
end $$;
create trigger enrollments_timeline after insert or update of status on public.outreach_enrollments for each row execute function public.enrollments_timeline();

-- Messages keep the thread and the timeline current.
create or replace function public.outreach_messages_thread() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_at timestamptz;
begin
  if new.lead_id is null then return new; end if;
  if tg_op = 'INSERT' and new.direction = 'inbound' then
    v_at := coalesce(new.received_at, new.created_at);
    insert into public.inbox_threads (workspace_id, lead_id, last_message_at, last_inbound_at) values (new.workspace_id, new.lead_id, v_at, v_at)
      on conflict (lead_id) do update set last_message_at = greatest(coalesce(inbox_threads.last_message_at, v_at), v_at),
        last_inbound_at = greatest(coalesce(inbox_threads.last_inbound_at, v_at), v_at), status = 'open';
    insert into public.lead_activities (workspace_id, lead_id, kind, actor_id, actor_kind, body, meta)
    values (new.workspace_id, new.lead_id, 'reply_logged', auth.uid(), public.current_actor_kind(), left(new.body, 500), jsonb_build_object('message_id', new.id, 'channel', new.channel));
  elsif tg_op = 'INSERT' then
    insert into public.inbox_threads (workspace_id, lead_id, last_message_at) values (new.workspace_id, new.lead_id, new.created_at)
      on conflict (lead_id) do update set last_message_at = greatest(coalesce(inbox_threads.last_message_at, excluded.last_message_at), excluded.last_message_at);
    insert into public.lead_activities (workspace_id, lead_id, kind, actor_id, actor_kind, body, meta)
    values (new.workspace_id, new.lead_id, 'message_drafted', new.created_by, public.current_actor_kind(), nullif(new.subject, ''),
            jsonb_build_object('message_id', new.id, 'channel', new.channel, 'step', new.step_position, 'campaign_id', new.outreach_campaign_id));
  elsif new.status = 'sent' and old.status is distinct from 'sent' then
    update public.inbox_threads set last_message_at = greatest(coalesce(last_message_at, new.sent_at), coalesce(new.sent_at, now())) where lead_id = new.lead_id;
    insert into public.lead_activities (workspace_id, lead_id, kind, actor_id, actor_kind, body, meta)
    values (new.workspace_id, new.lead_id, 'message_sent', auth.uid(), public.current_actor_kind(), nullif(new.subject, ''),
            jsonb_build_object('message_id', new.id, 'channel', new.channel, 'via', new.sent_via, 'step', new.step_position));
  end if;
  return new;
end $$;
create trigger outreach_messages_thread after insert or update of status on public.outreach_messages for each row execute function public.outreach_messages_thread();

-- Members still only move messages along the human steps (draft / approve /
-- cancel); "sent" (confirmed by the member) and replies are written by the server.
create or replace function public.outreach_member_transition() returns trigger
language plpgsql as $$
begin
  if auth.role() <> 'authenticated' then return new; end if;
  if old.direction = 'inbound' then raise exception 'replies can''t be changed'; end if;
  if old.status not in ('draft', 'approved', 'failed') then
    raise exception 'message can no longer be changed';
  end if;
  if new.status is distinct from old.status and not (
    (old.status = 'draft' and new.status in ('approved', 'canceled'))
    or (old.status = 'approved' and new.status in ('draft', 'canceled'))
    or (old.status = 'failed' and new.status in ('draft', 'canceled'))
  ) then
    raise exception 'not allowed: % -> %', old.status, new.status;
  end if;
  if new.status = 'approved' then
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  if (new.subject is distinct from old.subject or new.body is distinct from old.body or new.to_email is distinct from old.to_email) and new.status <> 'draft' then
    raise exception 'edit the message as a draft';
  end if;
  return new;
end $$;

-- ── CRM view (table + Kanban read the same rows) ─────────────────────────────
create or replace view public.crm_leads with (security_invoker = true) as
select l.*,
  t.status as thread_status,
  (t.last_inbound_at is not null and t.last_inbound_at > coalesce(t.last_read_at, '-infinity'::timestamptz)) as unread,
  (select m.starts_at from public.sales_meetings m where m.lead_id = l.id and m.status = 'scheduled' and m.starts_at >= now() - interval '2 hours' order by m.starts_at limit 1) as next_meeting_at,
  (select array_agg(oc.name order by e.created_at) from public.outreach_enrollments e join public.outreach_campaigns oc on oc.id = e.campaign_id where e.lead_id = l.id) as campaign_names,
  (select count(*) from public.lead_tasks k where k.lead_id = l.id and k.done_at is null)::int as open_tasks,
  co.domain as company_domain,
  coalesce(p.linkedin_url, co.linkedin_url) as linkedin_url,
  coalesce(p.phone, co.phone) as phone,
  p.title as job_title,
  coalesce(p.match_score, co.match_score) as match_score,
  t.last_message_at as thread_last_message_at
from public.sales_leads l
left join public.inbox_threads t on t.lead_id = l.id
left join public.prospects p on p.id = l.prospect_id
left join public.companies co on co.id = l.company_id;
grant select on public.crm_leads to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.workspace_knowledge enable row level security;
alter table public.business_offers enable row level security;
alter table public.competitors enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.sales_leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.lead_tasks enable row level security;
alter table public.sales_meetings enable row level security;
alter table public.outreach_campaigns enable row level security;
alter table public.outreach_steps enable row level security;
alter table public.outreach_enrollments enable row level security;
alter table public.inbox_threads enable row level security;
alter table public.workspace_ai_settings enable row level security;
alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;

-- Everyone in the workspace reads the shared business context; owners and
-- admins change it (like Settings → Organization).
create policy "members read knowledge" on public.workspace_knowledge for select using (public.is_workspace_member(workspace_id));
create policy "managers write knowledge" on public.workspace_knowledge for all using (public.is_workspace_manager(workspace_id)) with check (public.is_workspace_manager(workspace_id));
create policy "members read offers" on public.business_offers for select using (public.is_workspace_member(workspace_id));
create policy "managers write offers" on public.business_offers for all using (public.is_workspace_manager(workspace_id)) with check (public.is_workspace_manager(workspace_id));
create policy "members read competitors" on public.competitors for select using (public.is_workspace_member(workspace_id));
create policy "managers write competitors" on public.competitors for all using (public.is_workspace_manager(workspace_id)) with check (public.is_workspace_manager(workspace_id));
create policy "members read ai settings" on public.workspace_ai_settings for select using (public.is_workspace_member(workspace_id));
create policy "managers write ai settings" on public.workspace_ai_settings for all using (public.is_workspace_manager(workspace_id)) with check (public.is_workspace_manager(workspace_id));
create policy "members read automations" on public.automations for select using (public.is_workspace_member(workspace_id));
create policy "managers write automations" on public.automations for all using (public.is_workspace_manager(workspace_id)) with check (public.is_workspace_manager(workspace_id));
create policy "members read automation runs" on public.automation_runs for select using (public.is_workspace_member(workspace_id));

-- Customer profiles and the sales work itself: every member.
create policy "members all customer profiles" on public.customer_profiles for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members read leads" on public.sales_leads for select using (public.is_workspace_member(workspace_id));
create policy "members add leads" on public.sales_leads for insert with check (public.is_workspace_member(workspace_id));
create policy "members edit leads" on public.sales_leads for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "managers delete leads" on public.sales_leads for delete using (public.is_workspace_manager(workspace_id));
create policy "members read activities" on public.lead_activities for select using (public.is_workspace_member(workspace_id));
create policy "members add notes" on public.lead_activities for insert with check (public.is_workspace_member(workspace_id) and kind = 'note' and actor_id = auth.uid() and actor_kind = 'user');
create policy "members all tasks" on public.lead_tasks for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members all meetings" on public.sales_meetings for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members all outreach campaigns" on public.outreach_campaigns for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members all outreach steps" on public.outreach_steps for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members all enrollments" on public.outreach_enrollments for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members read threads" on public.inbox_threads for select using (public.is_workspace_member(workspace_id));
create policy "members update threads" on public.inbox_threads for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.workspace_knowledge, public.business_offers, public.competitors, public.workspace_ai_settings,
  public.automations, public.customer_profiles, public.lead_tasks, public.sales_meetings, public.outreach_campaigns, public.outreach_steps,
  public.outreach_enrollments to authenticated;
grant select, insert, update, delete on public.sales_leads to authenticated;
grant select, insert on public.lead_activities to authenticated;
grant select on public.automation_runs to authenticated;
grant select on public.inbox_threads to authenticated;
grant update (status, last_read_at) on public.inbox_threads to authenticated;
-- The lead key, identity links and do-not-contact history are server / DB work.
revoke update on public.sales_leads from authenticated;
grant update (stage, owner_id, deal_value, deal_currency, do_not_contact, customer_profile_id, name, company_name, email) on public.sales_leads to authenticated;
-- Steps reference their own workspace's campaign; enrollments their own leads.
create or replace function public.same_workspace_check() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Nested blocks: PL/pgSQL only prepares the branch for this table's columns.
  if tg_table_name in ('outreach_steps', 'outreach_enrollments') then
    if not exists (select 1 from public.outreach_campaigns c where c.id = new.campaign_id and c.workspace_id = new.workspace_id) then
      raise exception 'campaign not in workspace';
    end if;
  end if;
  if tg_table_name in ('outreach_enrollments', 'lead_tasks', 'sales_meetings', 'lead_activities') then
    if not exists (select 1 from public.sales_leads l where l.id = new.lead_id and l.workspace_id = new.workspace_id) then
      raise exception 'lead not in workspace';
    end if;
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['outreach_steps', 'outreach_enrollments', 'lead_tasks', 'sales_meetings', 'lead_activities'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.same_workspace_check()', t || '_same_ws', t);
  end loop;
end $$;

-- Two-factor sessions (D-117) on every new customer table.
do $$
declare t text;
begin
  foreach t in array array['workspace_knowledge', 'business_offers', 'competitors', 'customer_profiles', 'sales_leads', 'lead_activities',
    'lead_tasks', 'sales_meetings', 'outreach_campaigns', 'outreach_steps', 'outreach_enrollments', 'inbox_threads',
    'workspace_ai_settings', 'automations', 'automation_runs'] loop
    execute format('create policy "second factor done" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

-- Stage changes go through one function so the timeline knows who moved the
-- deal (member, agent or automation). Returns the stage_changed activity id
-- (the event automations run on), or null when nothing changed.
create or replace function public.set_lead_stage(p_lead uuid, p_stage text, p_actor text default 'user') returns bigint
language plpgsql security invoker set search_path = public as $$
declare v_act bigint;
begin
  if auth.role() = 'authenticated' then p_actor := 'user'; end if;
  if p_actor not in ('user', 'agent', 'automation', 'system') then raise exception 'bad actor'; end if;
  perform set_config('app.actor_kind', p_actor, true);
  update public.sales_leads set stage = p_stage where id = p_lead and stage is distinct from p_stage;
  if not found then return null; end if;
  select id into v_act from public.lead_activities where lead_id = p_lead and kind = 'stage_changed' order by id desc limit 1;
  return v_act;
end $$;
grant execute on function public.set_lead_stage(uuid, text, text) to authenticated, service_role;
