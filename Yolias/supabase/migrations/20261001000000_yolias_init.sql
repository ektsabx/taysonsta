-- Yolias — initial schema.
-- Workspace-scoped data: every row belongs to a workspace and is readable only
-- by that workspace's members (RLS). Membership and invitations are written by
-- the server (service role) after permission checks, never by the browser.

create extension if not exists pgcrypto;

-- ── helpers ────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── workspaces ─────────────────────────────────────────────────────────────
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text,
  website text,
  offering text,                                   -- "What do you sell?" — permanent AI context
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members(user_id);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

-- ── profiles ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  workspace_id uuid references public.workspaces(id) on delete set null,  -- active workspace
  onboarded_at timestamptz,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  text_size text not null default 'normal' check (text_size in ('compact', 'normal', 'large')),
  language text not null default 'en' check (language in ('en', 'ar')),
  timezone text not null default 'Asia/Riyadh',
  country text not null default 'SA',
  notify_campaign_done boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid());
$$;

-- ── strategies (Yolias AI requests; "Recent Strategy" history) ─────────────
create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  prompt text not null,
  attachments jsonb not null default '[]'::jsonb,
  icp jsonb,                                       -- parsed IcpCriteria (lib/discovery/types.ts)
  status text not null default 'understanding' check (status in ('understanding', 'ready', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index strategies_workspace_idx on public.strategies(workspace_id, created_at desc);
create trigger strategies_updated_at before update on public.strategies
  for each row execute function public.set_updated_at();

-- ── campaigns (search / discovery missions — not outreach) ─────────────────
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  strategy_id uuid unique references public.strategies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  criteria jsonb not null,                         -- IcpCriteria
  quota integer not null default 100 check (quota between 1 and 10000),
  status text not null default 'awaiting_source'
    check (status in ('awaiting_source', 'queued', 'running', 'completed', 'failed', 'paused')),
  companies_found integer not null default 0,
  prospects_found integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_workspace_idx on public.campaigns(workspace_id, created_at desc);
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

-- AI activity / progress feed for a campaign.
create table public.campaign_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  stage text not null check (stage in ('understand', 'plan', 'companies', 'people', 'enrich', 'verify', 'qualify', 'deliver')),
  level text not null default 'info' check (level in ('info', 'success', 'warning', 'error')),
  message text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index campaign_events_campaign_idx on public.campaign_events(campaign_id, created_at);

-- ── discovered companies & prospects ───────────────────────────────────────
-- `source` / `source_ref` record which data provider produced the row, so
-- providers can be added later without schema changes.
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  domain text,
  industry text,
  description text,
  city text,
  country text,                                    -- ISO 3166-1 alpha-2
  employee_count integer,
  funding_stage text,
  funding_total_usd numeric,
  hiring_roles integer,
  signals jsonb not null default '[]'::jsonb,
  source text not null,
  source_ref text,
  raw jsonb,
  created_at timestamptz not null default now()
);
create unique index companies_campaign_domain_uq on public.companies(campaign_id, lower(domain)) where domain is not null;
create index companies_workspace_idx on public.companies(workspace_id, created_at desc);

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  full_name text not null,
  title text,
  seniority text check (seniority in ('founder', 'c_level', 'vp', 'director', 'head', 'manager', 'other')),
  email text,
  email_status text not null default 'unknown' check (email_status in ('unknown', 'found', 'verified', 'invalid')),
  phone text,
  whatsapp text,
  linkedin_url text,
  city text,
  country text,
  match_score integer check (match_score between 0 and 100),
  match_reasons jsonb not null default '[]'::jsonb,
  saved_at timestamptz,                            -- "Save to Prospects"
  source text not null,
  source_ref text,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index prospects_workspace_idx on public.prospects(workspace_id, created_at desc);
create index prospects_campaign_idx on public.prospects(campaign_id);

-- ── new user bootstrap ─────────────────────────────────────────────────────
-- Creates the profile; joins the inviting workspace when a pending invitation
-- exists for the email, otherwise creates the user's own workspace.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv public.workspace_invitations;
  ws uuid;
begin
  select * into inv from public.workspace_invitations
    where email = lower(new.email) and accepted_at is null
    order by created_at desc limit 1;

  if inv.id is not null then
    ws := inv.workspace_id;
    insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, inv.role)
      on conflict do nothing;
    update public.workspace_invitations set accepted_at = now() where id = inv.id;
  else
    insert into public.workspaces (created_by) values (new.id) returning id into ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, 'owner');
  end if;

  insert into public.profiles (id, email, workspace_id) values (new.id, lower(new.email), ws);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── row level security ─────────────────────────────────────────────────────
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.profiles enable row level security;
alter table public.strategies enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_events enable row level security;
alter table public.companies enable row level security;
alter table public.prospects enable row level security;

create policy "members read workspace" on public.workspaces for select using (public.is_workspace_member(id));
create policy "members read members" on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy "members read invitations" on public.workspace_invitations for select using (public.is_workspace_member(workspace_id));

create policy "read own profile" on public.profiles for select using (id = auth.uid());
create policy "read teammates" on public.profiles for select using (
  exists (select 1 from public.workspace_members m where m.user_id = profiles.id and public.is_workspace_member(m.workspace_id))
);
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "members all strategies" on public.strategies for all
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members all campaigns" on public.campaigns for all
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members read events" on public.campaign_events for select using (public.is_workspace_member(workspace_id));
create policy "members read companies" on public.companies for select using (public.is_workspace_member(workspace_id));
create policy "members all prospects" on public.prospects for all
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- ── avatars bucket ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

create policy "avatar upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
