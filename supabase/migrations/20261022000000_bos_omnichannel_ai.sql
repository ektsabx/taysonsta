-- Omnichannel support + AI workforce (docs/bos/39 §5). Additive only.

-- 1. More channels feed the one inbox and replies go back the same way.
alter table bos_conversations drop constraint if exists bos_conversations_channel_check;
alter table bos_conversations add constraint bos_conversations_channel_check
  check (channel = any (array['web_widget', 'email', 'whatsapp', 'sms', 'portal', 'phone', 'manual', 'instagram', 'messenger', 'telegram']));
alter table bos_conversations add column if not exists handoff_reason text check (handoff_reason is null or length(handoff_reason) <= 300);

-- Channel identities of a customer (Messenger PSID, Instagram IGSID, Telegram chat id).
alter table support_customers
  add column if not exists messenger_id text,
  add column if not exists instagram_id text,
  add column if not exists telegram_id text;
create unique index if not exists support_customers_messenger_idx on support_customers (messenger_id) where messenger_id is not null and merged_into is null;
create unique index if not exists support_customers_instagram_idx on support_customers (instagram_id) where instagram_id is not null and merged_into is null;
create unique index if not exists support_customers_telegram_idx on support_customers (telegram_id) where telegram_id is not null and merged_into is null;

-- 2. AI agents: identity, purpose, channels, operating mode, hours, tools, routing.
alter table ai_agents
  add column if not exists description text check (description is null or length(description) <= 500),
  add column if not exists avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  add column if not exists purpose text not null default 'support' check (purpose in ('support', 'sales', 'general')),
  add column if not exists company_description text check (company_description is null or length(company_description) <= 4000),
  add column if not exists channels text[] not null default array['web_widget'],
  add column if not exists mode text not null default 'ai_first' check (mode in ('ai_first', 'human_first', 'rules')),
  add column if not exists activation_rules jsonb not null default '{}'::jsonb,
  add column if not exists working_hours jsonb not null default '{}'::jsonb,
  add column if not exists handle_reopened boolean not null default true,
  add column if not exists use_kb boolean not null default true,
  add column if not exists tools text[] not null default '{}',
  add column if not exists routing_rules jsonb not null default '[]'::jsonb,
  add column if not exists collect_fields text[] not null default '{}';

-- 3. Training sources (website pages, FAQ, files, text) and their indexed chunks.
create table if not exists ai_agent_sources (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references ai_agents(id) on delete cascade,
  kind text not null check (kind in ('website', 'faq', 'file', 'text')),
  title text not null check (length(title) between 1 and 300),
  url text check (url is null or url ~ '^https?://'),
  question text,
  answer text,
  file_path text,
  file_name text,
  status text not null default 'pending' check (status in ('pending', 'indexing', 'indexed', 'failed')),
  error text,
  chars integer not null default 0,
  chunks integer not null default 0,
  max_pages integer not null default 1 check (max_pages between 1 and 25),
  indexed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_agent_sources_agent_idx on ai_agent_sources (agent_id, created_at desc);

create table if not exists ai_agent_chunks (
  id bigint generated always as identity primary key,
  source_id uuid not null references ai_agent_sources(id) on delete cascade,
  agent_id uuid not null references ai_agents(id) on delete cascade,
  idx integer not null,
  title text not null,
  url text,
  content text not null,
  search tsvector generated always as (to_tsvector('simple', coalesce(title, '') || ' ' || content)) stored
);
create index if not exists ai_agent_chunks_agent_idx on ai_agent_chunks (agent_id);
create index if not exists ai_agent_chunks_search_idx on ai_agent_chunks using gin (search);

create trigger ai_agent_sources_touch before update on ai_agent_sources for each row execute function bos_touch_updated_at();

alter table ai_agent_sources enable row level security;
alter table ai_agent_chunks enable row level security;
grant select, insert, update, delete on ai_agent_sources, ai_agent_chunks to service_role;
grant usage, select on sequence ai_agent_chunks_id_seq to service_role;
