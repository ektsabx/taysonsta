-- CRM: Clients + Proposal Management System
-- Clients are the CRM entity; Proposals are the first CRM workflow stage.
-- Contracts/Invoices/Product Specs are future stages that will reference proposals(id)
-- once built — no forward columns are added here to avoid dangling references.

create type crm_stage as enum (
  'lead',
  'qualified',
  'call_booked',
  'call_completed',
  'proposal_requested',
  'proposal_sent',
  'proposal_viewed',
  'proposal_accepted',
  'proposal_rejected',
  'contract',
  'invoice',
  'project'
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  email text not null,
  phone text,
  country text,
  website text,
  crm_stage crm_stage not null default 'lead',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_crm_stage_idx on clients (crm_stage);
create index clients_created_at_idx on clients (created_at desc);

-- Optional link from an existing call booking to the CRM client it belongs to.
alter table bookings add column client_id uuid references clients(id) on delete set null;
create index bookings_client_idx on bookings (client_id);

create type proposal_status as enum (
  'draft',
  'ready',
  'published',
  'viewed',
  'accepted',
  'rejected',
  'expired'
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete restrict,
  slug text unique not null,
  title text not null,
  subtitle text,
  status proposal_status not null default 'draft',
  is_archived boolean not null default false,

  -- Editable working copy. Admin can change this freely pre- and post-publish
  -- without affecting what the client has already been shown.
  content jsonb not null default '{}'::jsonb,

  -- Frozen copies written at publish time. The client-facing page only ever
  -- reads these two columns, never `content` or a live project join, so an
  -- edit to a draft (or to a case study used elsewhere) never mutates a
  -- proposal the client has already seen until the next explicit publish.
  published_content jsonb,
  published_projects_snapshot jsonb not null default '[]'::jsonb,

  published_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index proposals_client_idx on proposals (client_id);
create index proposals_status_idx on proposals (status);
create index proposals_created_at_idx on proposals (created_at desc);

-- Live selection of case studies to feature, used while the proposal is a
-- draft (builder always shows fresh case study data). Resolved into
-- `published_projects_snapshot` at publish time.
create table proposal_projects (
  proposal_id uuid not null references proposals(id) on delete cascade,
  case_study_id uuid not null references case_studies(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (proposal_id, case_study_id)
);

-- Dedicated login for the client this proposal belongs to. One proposal has
-- at most one access record; the auth user it points to is never treated as
-- staff (see lib/auth.ts, which checks app_metadata.role).
create table proposal_access (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid unique not null references proposals(id) on delete cascade,
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table clients enable row level security;
alter table proposals enable row level security;
alter table proposal_projects enable row level security;
alter table proposal_access enable row level security;

-- CRM authoring data (clients, draft content, project selection, access
-- credentials) is only ever touched by the admin app layer through the
-- service-role client, gated by requireAdminUser() — same pattern as
-- career_applications / career_interviews.
grant all on public.clients to service_role;
grant all on public.proposals to service_role;
grant all on public.proposal_projects to service_role;
grant all on public.proposal_access to service_role;

-- The proposal's own client may read ONLY their own proposal, and only once
-- it has left draft/ready state. This is enforced at the database layer via
-- RLS keyed off auth.uid(), not by the obscurity of the slug in the URL.
grant select on public.proposals to authenticated;
create policy "client reads own published proposal" on proposals
  for select to authenticated
  using (
    status in ('published', 'viewed', 'accepted', 'rejected', 'expired')
    and exists (
      select 1 from proposal_access pa
      where pa.proposal_id = proposals.id
        and pa.auth_user_id = auth.uid()
    )
  );
