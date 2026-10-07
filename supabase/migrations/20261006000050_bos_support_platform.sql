-- Master upgrade Phase 7 (docs/bos/30 §10.1–10.5; doc 31): support platform.
-- Customer profiles (linked to contacts/clients when known), multi-channel
-- conversations with messages, support teams + agents, tickets linked to
-- conversations (existing tickets table), KB flags for AI (used in Phase 8).

insert into document_sequences (key, prefix, padding) values ('conversation', 'CV-', 6) on conflict (key) do nothing;

-- ------------------------------------------------------------ customers
create table support_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  normalized_email text generated always as (nullif(lower(trim(email)), '')) stored,
  phone text,
  normalized_phone text generated always as (nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')) stored,
  whatsapp text,
  company text,
  country text,
  source text,                                    -- widget / email / whatsapp / portal / manual / import
  first_channel text,
  contact_id uuid references contacts(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  tags text[] not null default '{}',
  notes text,
  merged_into uuid references support_customers(id) on delete set null,
  last_seen_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_customers_email_idx on support_customers (normalized_email) where merged_into is null;
create index support_customers_phone_idx on support_customers (normalized_phone) where merged_into is null;
create index support_customers_contact_idx on support_customers (contact_id);
create index support_customers_client_idx on support_customers (client_id);
create trigger support_customers_touch before update on support_customers for each row execute function bos_touch_updated_at();

-- ------------------------------------------------------------ teams
create table support_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  assignment text not null default 'least_busy' check (assignment in ('least_busy','round_robin','manual')),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index support_teams_default_idx on support_teams (is_default) where is_default;

create table support_team_members (
  team_id uuid not null references support_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'agent' check (role in ('agent','lead')),
  max_open int not null default 20 check (max_open between 1 and 500),
  is_available boolean not null default true,
  last_assigned_at timestamptz,
  primary key (team_id, user_id)
);

-- ------------------------------------------------------------ conversations
create table bos_conversations (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default bos_next_number('conversation'),
  customer_id uuid not null references support_customers(id) on delete restrict,
  channel text not null check (channel in ('web_widget','email','whatsapp','sms','portal','phone','manual')),
  subject text,
  status text not null default 'open' check (status in ('open','pending_customer','pending_internal','snoozed','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  team_id uuid references support_teams(id) on delete set null,
  assignee_id uuid references auth.users(id) on delete set null,
  ticket_id uuid references tickets(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  tags text[] not null default '{}',
  external_thread_id text,                        -- email thread / WhatsApp contact id
  widget_id uuid,                                 -- Phase 8
  ai_active boolean not null default false,       -- Phase 8: AI agent answering
  handed_off_at timestamptz,
  snoozed_until timestamptz,
  first_response_at timestamptz,
  last_message_at timestamptz not null default now(),
  last_customer_message_at timestamptz,
  last_agent_message_at timestamptz,
  unread_for_agent int not null default 0,
  reopened_count int not null default 0,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bos_conversations_inbox_idx on bos_conversations (status, last_message_at desc);
create index bos_conversations_assignee_idx on bos_conversations (assignee_id, status);
create index bos_conversations_team_idx on bos_conversations (team_id, status);
create index bos_conversations_customer_idx on bos_conversations (customer_id, created_at desc);
create unique index bos_conversations_thread_idx on bos_conversations (channel, external_thread_id) where external_thread_id is not null and status not in ('resolved','closed');
create trigger bos_conversations_touch before update on bos_conversations for each row execute function bos_touch_updated_at();

create table conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references bos_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound','internal','system')),
  author_kind text not null check (author_kind in ('customer','agent','ai','system')),
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,   -- [{file_id,name,size}]
  channel text not null,
  external_id text,                                  -- provider message id (idempotency)
  delivery_status text check (delivery_status in ('queued','sent','delivered','read','failed','skipped')),
  delivery_error text,
  ai_sources jsonb,                                  -- Phase 8: KB articles used
  created_at timestamptz not null default now()
);
create index conversation_messages_conv_idx on conversation_messages (conversation_id, created_at);
create unique index conversation_messages_external_idx on conversation_messages (channel, external_id) where external_id is not null;

-- Ticket ↔ conversation link (tickets keep all their existing behaviour).
alter table tickets add column if not exists conversation_id uuid references bos_conversations(id) on delete set null;
alter table tickets add column if not exists support_customer_id uuid references support_customers(id) on delete set null;
alter table tickets add column if not exists team_id uuid references support_teams(id) on delete set null;
-- Tickets from the inbox may be for people who aren't account contacts yet.
alter table tickets alter column client_id drop not null;

-- Knowledge base: language, audience and whether AI agents may use it.
alter table kb_articles add column if not exists language text not null default 'ar' check (language in ('ar','en'));
alter table kb_articles add column if not exists audience text not null default 'internal' check (audience in ('internal','public'));
alter table kb_articles add column if not exists ai_allowed boolean not null default false;

alter table support_customers enable row level security;
alter table support_teams enable row level security;
alter table support_team_members enable row level security;
alter table bos_conversations enable row level security;
alter table conversation_messages enable row level security;
grant all on support_customers, support_teams, support_team_members, bos_conversations, conversation_messages to service_role;

-- Default team from the existing support role (people keep their roles).
insert into support_teams (name, description, is_default) values ('الدعم الفني', 'فريق الدعم الافتراضي', true) on conflict (name) do nothing;
insert into support_team_members (team_id, user_id, role)
select t.id, ur.user_id, 'agent'
from support_teams t cross join user_roles ur join roles r on r.id = ur.role_id
where t.is_default and r.key = 'support'
on conflict do nothing;

-- Permissions: conversations module (support staff work the inbox; managers see all).
insert into permissions (key, module, action, description)
select 'conversations.' || a::text, 'conversations', a, 'Support conversations — ' || replace(a::text, '_', ' ')
from unnest(enum_range(null::permission_action)) as a
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, (case when r.key in ('super_admin','admin','executive','support') then 'all' else 'assigned' end)::permission_scope
from roles r join permissions p on p.module = 'conversations'
where (r.key in ('super_admin','admin'))
   or (r.key = 'support' and p.action::text in ('read','create','update','assign','export'))
   or (r.key in ('executive') and p.action::text in ('read','export'))
   or (r.key in ('account_manager','project_manager') and p.action::text in ('read','update'))
on conflict (role_id, permission_id) do nothing;
