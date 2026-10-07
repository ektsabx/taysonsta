-- Master upgrade Phase 8 (docs/bos/30 §10.5–10.6; doc 31): website support
-- widget + AI support agents. Additive only.

-- ------------------------------------------------------------ AI agents
create table ai_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  persona text,                                        -- who the agent is (shown to the model)
  tone text not null default 'friendly' check (tone in ('friendly','formal','concise')),
  language text not null default 'auto' check (language in ('auto','ar','en')),
  instructions text,                                   -- extra rules from the admin
  kb_category_ids uuid[] not null default '{}',        -- empty = every AI-allowed article
  provider text check (provider in ('anthropic','openai','gemini')),  -- null = hub fallback order
  max_ai_turns int not null default 6 check (max_ai_turns between 1 and 50),
  min_confidence numeric(3,2) not null default 0.60 check (min_confidence between 0 and 1),
  handoff_keywords text[] not null default array['human','agent','موظف','شخص','بشري','مدير'],
  sensitive_keywords text[] not null default array['refund','lawyer','legal','cancel contract','استرداد','محامي','قضية','الغاء العقد','إلغاء العقد'],
  handoff_message text not null default 'سأحوّلك الآن إلى أحد أعضاء فريق الدعم، وسيرد عليك قريباً.',
  fallback_message text not null default 'لم أجد إجابة مؤكدة في قاعدة المعرفة. سأحوّل سؤالك إلى فريق الدعم.',
  monthly_cost_limit_usd numeric(10,2) not null default 0 check (monthly_cost_limit_usd >= 0),  -- 0 = no agent limit
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger ai_agents_touch before update on ai_agents for each row execute function bos_touch_updated_at();

-- ------------------------------------------------------------ widgets
create table support_widgets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  public_key text not null unique default encode(gen_random_bytes(12), 'hex'),
  is_active boolean not null default true,
  allowed_domains text[] not null default '{}',        -- exact hosts; "*.example.com" allowed; empty = nowhere
  title text not null default 'تواصل معنا',
  welcome_message text not null default 'أهلاً! كيف يمكننا مساعدتك؟',
  offline_message text not null default 'فريقنا غير متاح الآن. اترك رسالتك وسنرد عليك عبر البريد.',
  primary_color text not null default '#6d28d9' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  position text not null default 'right' check (position in ('right','left')),
  bottom_offset int not null default 20 check (bottom_offset between 0 and 400),
  language text not null default 'ar' check (language in ('ar','en')),
  require_email boolean not null default true,
  working_hours jsonb not null default '{}'::jsonb,    -- {"tz":"Africa/Cairo","days":[0..6],"start":"09:00","end":"18:00"}; {} = always
  ai_agent_id uuid references ai_agents(id) on delete set null,
  team_id uuid references support_teams(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger support_widgets_touch before update on support_widgets for each row execute function bos_touch_updated_at();

alter table bos_conversations
  add constraint bos_conversations_widget_fk foreign key (widget_id) references support_widgets(id) on delete set null;
alter table bos_conversations add column if not exists ai_agent_id uuid references ai_agents(id) on delete set null;
alter table bos_conversations add column if not exists ai_turns int not null default 0;

-- A browser visitor: only a hash of the random token given to the browser is stored.
create table widget_sessions (
  id uuid primary key default gen_random_uuid(),
  widget_id uuid not null references support_widgets(id) on delete cascade,
  token_hash text not null unique,
  customer_id uuid references support_customers(id) on delete set null,
  conversation_id uuid references bos_conversations(id) on delete set null,
  origin text,
  page_url text,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index widget_sessions_widget_idx on widget_sessions (widget_id, created_at desc);

alter table ai_agents enable row level security;
alter table support_widgets enable row level security;
alter table widget_sessions enable row level security;
grant all on ai_agents, support_widgets, widget_sessions to service_role;

-- Default agent (inactive until the admin enables it with a configured AI provider).
insert into ai_agents (name, persona, is_active)
values ('مساعد الدعم', 'مساعد دعم فني لشركة Taysonsta يجيب من قاعدة المعرفة فقط.', false)
on conflict (name) do nothing;

-- Notification templates for AI hand-off.
insert into notification_templates (event_type, language, title, body, priority) values
  ('conversation.handed_off', 'ar', 'تحويل من المساعد الذكي: {{payload.title}}', '{{payload.reason}}', 'high'),
  ('conversation.handed_off', 'en', 'AI agent hand-off: {{payload.title}}', '{{payload.reason}}', 'high')
on conflict (event_type, language) do nothing;

insert into notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
select 'conversation.handed_off', 'relation', 'assignee', '{in_app}', true
where not exists (select 1 from notification_subscriptions s where s.event_type = 'conversation.handed_off' and s.relation = 'assignee');
