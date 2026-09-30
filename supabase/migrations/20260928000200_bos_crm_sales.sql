-- Taysonsta BOS — Phase 2: CRM & Sales.
-- Extends the existing `clients` (now the Account entity) and `proposals`
-- tables instead of rebuilding them. See docs/bos/02-database.md §4,
-- 05-crm.md, 06-sales.md, 07-activities-tasks.md, 08-proposals-contracts.md.

create type pipeline_entity as enum ('lead','deal');
create type stage_category as enum ('open','won','lost');
create type account_status as enum ('prospect','active','inactive','churned');
create type deal_payment_status as enum ('unpaid','partially_paid','paid');
create type activity_type as enum ('call','email','whatsapp','linkedin','meeting','follow_up','task','note','internal','client_communication');
create type activity_status as enum ('pending','in_progress','completed','cancelled','overdue');
create type meeting_status as enum ('scheduled','completed','cancelled','no_show');
create type product_kind as enum ('product','service');

-- ---------------------------------------------------------------------------
-- Configuration: sources, pipelines, products
-- ---------------------------------------------------------------------------

create table lead_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into lead_sources (name, sort_order) values
  ('Website', 1), ('Booking form', 2), ('LinkedIn', 3), ('Referral', 4), ('Instagram', 5),
  ('WhatsApp', 6), ('Cold outreach', 7), ('Event', 8), ('Partner', 9), ('Other', 10);

create table pipelines (
  id uuid primary key default gen_random_uuid(),
  entity pipeline_entity not null,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (entity, name)
);
create unique index pipelines_default_idx on pipelines (entity) where is_default;

create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  key text not null check (key ~ '^[a-z_]+$'),
  name text not null,
  sort_order integer not null default 0,
  probability numeric(5,2) not null default 0 check (probability between 0 and 100),
  category stage_category not null default 'open',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (pipeline_id, key)
);
create index pipeline_stages_pipeline_idx on pipeline_stages (pipeline_id, sort_order);

with p as (
  insert into pipelines (entity, name, is_default) values ('lead', 'Lead pipeline', true) returning id
)
insert into pipeline_stages (pipeline_id, key, name, sort_order, probability, category)
select p.id, s.key, s.name, s.ord, 0, s.cat::stage_category
from p, (values
  ('new', 'New', 1, 'open'),
  ('contacted', 'Contacted', 2, 'open'),
  ('replied', 'Replied', 3, 'open'),
  ('qualified', 'Qualified', 4, 'open'),
  ('meeting', 'Meeting', 5, 'open'),
  ('proposal', 'Proposal', 6, 'open'),
  ('negotiation', 'Negotiation', 7, 'open'),
  ('won', 'Won', 8, 'won'),
  ('lost', 'Lost', 9, 'lost')
) as s(key, name, ord, cat);

with p as (
  insert into pipelines (entity, name, is_default) values ('deal', 'Deal pipeline', true) returning id
)
insert into pipeline_stages (pipeline_id, key, name, sort_order, probability, category)
select p.id, s.key, s.name, s.ord, s.prob, s.cat::stage_category
from p, (values
  ('qualified', 'Qualified', 1, 10, 'open'),
  ('discovery', 'Discovery', 2, 20, 'open'),
  ('proposal', 'Proposal', 3, 40, 'open'),
  ('negotiation', 'Negotiation', 4, 60, 'open'),
  ('contract', 'Contract', 5, 80, 'open'),
  ('won', 'Won', 6, 100, 'won'),
  ('lost', 'Lost', 7, 0, 'lost')
) as s(key, name, ord, prob, cat);

create table products (
  id uuid primary key default gen_random_uuid(),
  kind product_kind not null default 'service',
  name text not null,
  description text,
  sku text unique,
  category text,
  default_price numeric(14,3) check (default_price is null or default_price >= 0),
  currency char(3) references currencies(code),
  pricing_model text not null default 'fixed' check (pricing_model in ('fixed','hourly','monthly','custom')),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_name_idx on products (kind, lower(name)) where archived_at is null;

-- ---------------------------------------------------------------------------
-- Accounts (existing `clients`) and contacts
-- ---------------------------------------------------------------------------

alter table clients
  add column account_status account_status not null default 'active',
  add column industry text,
  add column city text,
  add column address text,
  add column tax_id text,
  add column account_manager_id uuid references auth.users(id) on delete set null,
  add column default_currency char(3) references currencies(code),
  add column normalized_email text generated always as (lower(trim(email))) stored,
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users(id) on delete set null;

create index clients_account_manager_idx on clients (account_manager_id);
create index clients_status_idx on clients (account_status);
create index clients_name_trgm_idx on clients using gin (name extensions.gin_trgm_ops);
create index clients_company_trgm_idx on clients using gin (company_name extensions.gin_trgm_ops);

-- Prevent duplicate accounts (§67). Only created when current data has no
-- duplicates; otherwise we log and leave the merge to an admin, since a
-- migration must never silently merge or drop client records.
do $$
begin
  if exists (
    select normalized_email from clients where archived_at is null
    group by normalized_email having count(*) > 1
  ) then
    raise notice 'clients has duplicate emails — unique index skipped; merge duplicates via Settings then re-run bos_ensure_client_email_unique()';
  else
    create unique index clients_normalized_email_idx on clients (normalized_email) where archived_at is null;
  end if;
end;
$$;

create or replace function public.bos_ensure_client_email_unique()
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from pg_indexes where indexname = 'clients_normalized_email_idx') then
    create unique index clients_normalized_email_idx on clients (normalized_email) where archived_at is null;
  end if;
end;
$$;

create table contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete restrict,
  full_name text not null check (length(trim(full_name)) > 0),
  position text,
  email text,
  phone text,
  whatsapp text,
  linkedin_url text,
  is_decision_maker boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index contacts_email_idx on contacts (lower(trim(email))) where email is not null and archived_at is null;
create index contacts_client_idx on contacts (client_id);
create index contacts_name_trgm_idx on contacts using gin (full_name extensions.gin_trgm_ops);

alter table clients add column primary_contact_id uuid references contacts(id) on delete set null;

-- Legacy accounts had the contact person folded into the account row; give
-- each one a primary contact so deals/meetings can reference a contact.
with inserted as (
  insert into contacts (client_id, full_name, email, phone, created_by, created_at)
  select c.id, c.name, c.email, c.phone, c.created_by, c.created_at
  from clients c
  where not exists (select 1 from contacts ct where lower(trim(ct.email)) = lower(trim(c.email)))
  returning id, client_id
)
update clients set primary_contact_id = inserted.id
from inserted where clients.id = inserted.client_id;

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------

create table leads (
  id uuid primary key default gen_random_uuid(),
  lead_number text not null unique default bos_next_number('lead'),
  name text not null check (length(trim(name)) > 0),
  company_name text,
  contact_name text,
  email text,
  phone text,
  website text,
  country text,
  city text,
  industry text,
  source_id uuid references lead_sources(id) on delete set null,
  estimated_budget numeric(14,3) check (estimated_budget is null or estimated_budget >= 0),
  budget_currency char(3) references currencies(code),
  product_interest_id uuid references products(id) on delete set null,
  business_stage text,
  timeline text,
  decision_maker text,
  current_solution text,
  problem text,
  notes text,
  assigned_to uuid references auth.users(id) on delete set null,
  team_id uuid references teams(id) on delete set null,
  priority priority_level not null default 'medium',
  stage_id uuid not null references pipeline_stages(id) on delete restrict,
  budget_score smallint not null default 0 check (budget_score between 0 and 25),
  fit_score smallint not null default 0 check (fit_score between 0 and 25),
  intent_score smallint not null default 0 check (intent_score between 0 and 25),
  engagement_score smallint not null default 0 check (engagement_score between 0 and 25),
  total_score smallint generated always as (budget_score + fit_score + intent_score + engagement_score) stored,
  client_id uuid references clients(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  booking_id uuid references bookings(id) on delete set null,
  converted_deal_id uuid,
  converted_at timestamptz,
  lost_reason text,
  last_activity_at timestamptz,
  next_activity_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  check (estimated_budget is null or budget_currency is not null)
);
create unique index leads_email_idx on leads (lower(trim(email))) where email is not null and archived_at is null;
create index leads_assigned_stage_idx on leads (assigned_to, stage_id) where archived_at is null;
create index leads_stage_idx on leads (stage_id);
create index leads_source_idx on leads (source_id);
create index leads_country_idx on leads (country);
create index leads_created_idx on leads (created_at desc);
create index leads_client_idx on leads (client_id);
create index leads_next_activity_idx on leads (next_activity_at) where archived_at is null;
create index leads_name_trgm_idx on leads using gin (name extensions.gin_trgm_ops);
create index leads_company_trgm_idx on leads using gin (company_name extensions.gin_trgm_ops);

alter table clients add column source_lead_id uuid references leads(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Deals
-- ---------------------------------------------------------------------------

create table deals (
  id uuid primary key default gen_random_uuid(),
  deal_number text not null unique default bos_next_number('deal'),
  name text not null check (length(trim(name)) > 0),
  client_id uuid not null references clients(id) on delete restrict,
  contact_id uuid references contacts(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  source_id uuid references lead_sources(id) on delete set null,
  pipeline_id uuid not null references pipelines(id) on delete restrict,
  stage_id uuid not null references pipeline_stages(id) on delete restrict,
  value numeric(14,3) not null default 0 check (value >= 0),
  currency char(3) not null references currencies(code),
  probability numeric(5,2) not null default 10 check (probability between 0 and 100),
  expected_close_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  payment_status deal_payment_status not null default 'unpaid',
  payment_terms jsonb not null default '[]'::jsonb check (jsonb_typeof(payment_terms) = 'array'),
  scope text,
  is_upsell boolean not null default false,
  previous_project_id uuid,
  previous_deal_id uuid references deals(id) on delete set null,
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  won_processed_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null
);
create index deals_client_idx on deals (client_id);
create index deals_lead_idx on deals (lead_id);
create index deals_assigned_stage_idx on deals (assigned_to, stage_id) where archived_at is null;
create index deals_stage_idx on deals (stage_id);
create index deals_close_idx on deals (expected_close_date);
create index deals_won_idx on deals (won_at) where won_at is not null;
create index deals_name_trgm_idx on deals using gin (name extensions.gin_trgm_ops);

alter table leads add constraint leads_converted_deal_fk foreign key (converted_deal_id) references deals(id) on delete set null;

create table deal_products (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  description text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,3) not null default 0 check (unit_price >= 0),
  line_total numeric(14,3) generated always as (round(quantity * unit_price, 3)) stored,
  sort_order integer not null default 0
);
create index deal_products_deal_idx on deal_products (deal_id);
create index deal_products_product_idx on deal_products (product_id);

-- ---------------------------------------------------------------------------
-- Activities (global) and meetings
-- ---------------------------------------------------------------------------

create table activities (
  id uuid primary key default gen_random_uuid(),
  type activity_type not null,
  title text not null check (length(trim(title)) > 0),
  description text,
  direction text check (direction in ('inbound','outbound','internal')),
  outcome text,
  lead_id uuid references leads(id) on delete cascade,
  deal_id uuid references deals(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  project_id uuid,
  assigned_to uuid references auth.users(id) on delete set null,
  priority priority_level not null default 'medium',
  status activity_status not null default 'pending',
  due_at timestamptz,
  start_at timestamptz,
  reminder_at timestamptz,
  reminder_sent_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (num_nonnulls(lead_id, deal_id, client_id, contact_id, project_id) >= 1)
);
create index activities_lead_idx on activities (lead_id, created_at desc);
create index activities_deal_idx on activities (deal_id, created_at desc);
create index activities_client_idx on activities (client_id, created_at desc);
create index activities_contact_idx on activities (contact_id, created_at desc);
create index activities_project_idx on activities (project_id, created_at desc);
create index activities_assigned_status_idx on activities (assigned_to, status, due_at) where archived_at is null;
create index activities_reminder_idx on activities (reminder_at) where reminder_sent_at is null and reminder_at is not null;

-- Keep leads.last_activity_at / next_activity_at in sync (§7 list columns).
create or replace function public.bos_sync_lead_activity_dates()
returns trigger
language plpgsql
as $$
declare
  v_lead uuid := coalesce(new.lead_id, old.lead_id);
begin
  if v_lead is null then
    return null;
  end if;

  update leads l set
    last_activity_at = (
      select max(coalesce(a.completed_at, a.created_at)) from activities a
      where a.lead_id = v_lead and a.archived_at is null
        and (a.status = 'completed' or a.type in ('note','email','call','whatsapp','linkedin','client_communication'))
    ),
    next_activity_at = (
      select min(coalesce(a.due_at, a.start_at)) from activities a
      where a.lead_id = v_lead and a.archived_at is null
        and a.status in ('pending','in_progress','overdue')
        and coalesce(a.due_at, a.start_at) is not null
    )
  where l.id = v_lead;

  return null;
end;
$$;

create trigger activities_sync_lead after insert or update or delete on activities
for each row execute function bos_sync_lead_activity_dates();

create table meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  lead_id uuid references leads(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  project_id uuid,
  organizer_id uuid references auth.users(id) on delete set null,
  start_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 600),
  meeting_link text,
  location text,
  notes text,
  outcome text,
  next_action text,
  status meeting_status not null default 'scheduled',
  follow_up_task_id uuid,
  booking_id uuid references bookings(id) on delete set null,
  reminder_sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meetings_start_idx on meetings (start_at);
create index meetings_lead_idx on meetings (lead_id);
create index meetings_deal_idx on meetings (deal_id);
create index meetings_client_idx on meetings (client_id);
create index meetings_project_idx on meetings (project_id);
create index meetings_organizer_idx on meetings (organizer_id, start_at);

create table meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  email text,
  response text not null default 'pending' check (response in ('pending','accepted','declined')),
  check (num_nonnulls(user_id, contact_id, email) >= 1)
);
create index meeting_attendees_meeting_idx on meeting_attendees (meeting_id);
create index meeting_attendees_user_idx on meeting_attendees (user_id);
create unique index meeting_attendees_user_unique on meeting_attendees (meeting_id, user_id) where user_id is not null;
create unique index meeting_attendees_contact_unique on meeting_attendees (meeting_id, contact_id) where contact_id is not null;

-- ---------------------------------------------------------------------------
-- Proposals (existing) — link to deals, structured totals, tracking dates
-- ---------------------------------------------------------------------------

alter table proposals
  add column deal_id uuid references deals(id) on delete set null,
  add column total_amount numeric(14,3) check (total_amount is null or total_amount >= 0),
  add column currency char(3) references currencies(code),
  add column payment_schedule jsonb not null default '[]'::jsonb,
  add column valid_until date,
  add column sent_at timestamptz,
  add column accepted_at timestamptz,
  add column rejected_at timestamptz,
  add column rejection_reason text,
  add column expired_at timestamptz,
  add column assumptions text,
  add column terms text,
  add column version integer not null default 1,
  add column owner_id uuid references auth.users(id) on delete set null;

update proposals set sent_at = published_at where published_at is not null and sent_at is null;
update proposals set owner_id = created_by where owner_id is null;

create index proposals_deal_idx on proposals (deal_id);
create index proposals_valid_until_idx on proposals (valid_until) where status in ('published','viewed');

-- ---------------------------------------------------------------------------
-- Email tracking (populated only when an email integration is enabled)
-- ---------------------------------------------------------------------------

create table email_threads (
  id uuid primary key default gen_random_uuid(),
  subject text,
  provider text,
  provider_thread_id text unique,
  lead_id uuid references leads(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  project_id uuid,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_threads_client_idx on email_threads (client_id);
create index email_threads_lead_idx on email_threads (lead_id);

create table email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references email_threads(id) on delete cascade,
  direction text not null check (direction in ('incoming','outgoing')),
  from_address text not null,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text,
  body_text text,
  body_html text,
  sent_at timestamptz not null,
  provider_message_id text unique,
  contact_id uuid references contacts(id) on delete set null,
  is_important boolean not null default false,
  created_at timestamptz not null default now()
);
create index email_messages_thread_idx on email_messages (thread_id, sent_at);

-- ---------------------------------------------------------------------------
-- Triggers, RLS, grants
-- ---------------------------------------------------------------------------

create trigger products_touch before update on products for each row execute function bos_touch_updated_at();
create trigger contacts_touch before update on contacts for each row execute function bos_touch_updated_at();
create trigger leads_touch before update on leads for each row execute function bos_touch_updated_at();
create trigger deals_touch before update on deals for each row execute function bos_touch_updated_at();
create trigger activities_touch before update on activities for each row execute function bos_touch_updated_at();
create trigger meetings_touch before update on meetings for each row execute function bos_touch_updated_at();

alter table lead_sources enable row level security;
alter table pipelines enable row level security;
alter table pipeline_stages enable row level security;
alter table products enable row level security;
alter table contacts enable row level security;
alter table leads enable row level security;
alter table deals enable row level security;
alter table deal_products enable row level security;
alter table activities enable row level security;
alter table meetings enable row level security;
alter table meeting_attendees enable row level security;
alter table email_threads enable row level security;
alter table email_messages enable row level security;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
revoke execute on function public.bos_ensure_client_email_unique() from public, anon, authenticated;
