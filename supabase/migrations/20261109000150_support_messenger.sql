-- Support messenger (2026-10-12, D-180): the website widget becomes a
-- messenger with Home / Messages / Help. Builds on the existing widget,
-- conversations, AI agent and inbox; no second messaging system.
--  * A visitor can have several conversations. `widget_visitor` says whose
--    they are: 'session:<widget_sessions.id>' for an anonymous visitor, or
--    'yolias:<user id>' for a signed-in Yolias user (identity signed by the
--    Yolias server, so it survives sign-out / sign-in and other devices).
--  * Ratings after a conversation is resolved, one per resolution.
--  * The name and photo a staff member shows to customers (opt-in photo).
-- Additive only.

alter table support_widgets
  add column if not exists identity_secret_enc text,
  add column if not exists ratings_enabled boolean not null default true,
  add column if not exists show_agent_photos boolean not null default true,
  add column if not exists help_enabled boolean not null default true;

alter table widget_sessions add column if not exists visitor_key text check (visitor_key is null or visitor_key ~ '^yolias:[0-9a-f-]{36}$');
create index if not exists widget_sessions_visitor_idx on widget_sessions (widget_id, visitor_key) where visitor_key is not null;

alter table bos_conversations add column if not exists widget_visitor text;
create index if not exists bos_conversations_widget_visitor_idx on bos_conversations (widget_id, widget_visitor, last_message_at desc) where widget_visitor is not null;

-- Existing widget conversations belong to the session that started them.
update bos_conversations c set widget_visitor = 'session:' || s.id
from widget_sessions s
where s.conversation_id = c.id and c.widget_visitor is null;

create table if not exists support_agent_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or length(trim(display_name)) between 1 and 60),
  show_photo boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists support_ratings (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references bos_conversations(id) on delete cascade,
  widget_id uuid references support_widgets(id) on delete set null,
  -- Which resolution this rates (reopened_count when rated): one rating each time.
  round int not null default 0,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 2000),
  responder_kind text not null check (responder_kind in ('ai', 'human')),
  agent_user_id uuid references auth.users(id) on delete set null,
  conversation_status text not null,
  visitor text,
  created_at timestamptz not null default now(),
  unique (conversation_id, round)
);
create index if not exists support_ratings_created_idx on support_ratings (created_at desc);
create index if not exists support_ratings_agent_idx on support_ratings (agent_user_id, created_at desc);

alter table support_agent_profiles enable row level security;
alter table support_ratings enable row level security;
grant all on support_agent_profiles, support_ratings to service_role;
