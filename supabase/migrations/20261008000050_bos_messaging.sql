-- Master upgrade Phase 9 (docs/bos/30 §11; doc 31): WhatsApp Business + SMS
-- messaging — templates, consent/opt-out, one outbound log with delivery
-- statuses and retry, click-to-WhatsApp website widget. Additive only.

-- ------------------------------------------------------------ templates
create table message_templates (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp','sms')),
  name text not null,                                   -- internal name; for WhatsApp = the approved template name
  language text not null default 'ar',                  -- WhatsApp language code (ar, en, en_US …)
  category text not null default 'utility' check (category in ('utility','marketing','authentication')),
  body text not null,                                   -- {{1}}, {{2}} … placeholders
  variables text[] not null default '{}',               -- labels for {{1}}, {{2}} … (help text)
  provider_status text not null default 'local' check (provider_status in ('local','pending','approved','rejected','paused','disabled')),
  provider_template_id text,
  connection_id uuid references integration_connections(id) on delete set null,
  is_active boolean not null default true,
  synced_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, name, language)
);
create trigger message_templates_touch before update on message_templates for each row execute function bos_touch_updated_at();

-- ------------------------------------------------------------ consent
-- One row per phone × channel × purpose. Transactional messages go unless
-- the person opted out of 'all'; marketing needs an explicit opt-in.
create table messaging_consents (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^[0-9]{7,15}$'),   -- normalised digits (E.164 without +)
  channel text not null check (channel in ('whatsapp','sms')),
  purpose text not null check (purpose in ('all','marketing')),
  status text not null check (status in ('opted_in','opted_out')),
  source text not null default 'manual',                 -- manual | inbound_keyword | form | import
  note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phone, channel, purpose)
);
create trigger messaging_consents_touch before update on messaging_consents for each row execute function bos_touch_updated_at();

-- ------------------------------------------------------------ outbound log
create table outbound_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp','sms')),
  connection_id uuid references integration_connections(id) on delete set null,
  to_phone text not null,
  purpose text not null default 'transactional' check (purpose in ('transactional','marketing')),
  template_id uuid references message_templates(id) on delete set null,
  variables jsonb not null default '[]'::jsonb,
  body text not null,                                    -- rendered text (what the person receives)
  status text not null default 'queued' check (status in ('queued','sent','delivered','read','failed','skipped')),
  error text,
  attempts int not null default 0,
  next_attempt_at timestamptz,
  provider_message_id text,
  dedupe_key text,
  entity_type text,                                      -- client | contact | employee | conversation | invoice …
  entity_id uuid,
  client_id uuid references clients(id) on delete set null,
  employee_id uuid references employees(id) on delete set null,
  conversation_message_id uuid references conversation_messages(id) on delete set null,
  notification_delivery_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz
);
create unique index outbound_messages_provider_idx on outbound_messages (channel, provider_message_id) where provider_message_id is not null;
create unique index outbound_messages_dedupe_idx on outbound_messages (dedupe_key) where dedupe_key is not null;
create index outbound_messages_recent_idx on outbound_messages (created_at desc);
create index outbound_messages_retry_idx on outbound_messages (status, next_attempt_at) where status = 'failed';
create index outbound_messages_entity_idx on outbound_messages (entity_type, entity_id);

-- ------------------------------------------------------------ click-to-WhatsApp widget
create table whatsapp_widgets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  public_key text not null unique default encode(gen_random_bytes(12), 'hex'),
  is_active boolean not null default true,
  phone text not null check (phone ~ '^[0-9]{7,15}$'),
  label text not null default 'تواصل عبر واتساب',
  greeting text not null default 'مرحباً، أريد الاستفسار عن خدماتكم',
  position text not null default 'right' check (position in ('right','left')),
  bottom_offset int not null default 20 check (bottom_offset between 0 and 400),
  allowed_domains text[] not null default '{}',          -- click counting only from these sites
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger whatsapp_widgets_touch before update on whatsapp_widgets for each row execute function bos_touch_updated_at();

create table whatsapp_widget_clicks (
  widget_id uuid not null references whatsapp_widgets(id) on delete cascade,
  day date not null,
  clicks int not null default 0,
  primary key (widget_id, day)
);

create or replace function public.bos_whatsapp_click(p_widget uuid)
returns void language sql as $$
  insert into whatsapp_widget_clicks (widget_id, day, clicks) values (p_widget, current_date, 1)
  on conflict (widget_id, day) do update set clicks = whatsapp_widget_clicks.clicks + 1;
$$;
grant execute on function public.bos_whatsapp_click(uuid) to service_role;
revoke execute on function public.bos_whatsapp_click(uuid) from public, anon, authenticated;

alter table message_templates enable row level security;
alter table messaging_consents enable row level security;
alter table outbound_messages enable row level security;
alter table whatsapp_widgets enable row level security;
alter table whatsapp_widget_clicks enable row level security;
grant all on message_templates, messaging_consents, outbound_messages, whatsapp_widgets, whatsapp_widget_clicks to service_role;

-- ------------------------------------------------------------ permissions
insert into permissions (key, module, action, description)
select 'messaging.' || a::text, 'messaging', a, 'WhatsApp / SMS messaging — ' || replace(a::text, '_', ' ')
from unnest(enum_range(null::permission_action)) as a
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, (case when r.key in ('super_admin','admin','executive','sales_manager') then 'all' else 'own' end)::permission_scope
from roles r join permissions p on p.module = 'messaging'
where (r.key in ('super_admin','admin'))
   or (r.key in ('support','account_manager','business_development','hr','hr_staff') and p.action::text in ('read','create'))
   or (r.key in ('executive') and p.action::text in ('read','export'))
   or (r.key in ('sales_manager') and p.action::text in ('read','create','update','manage'))
on conflict (role_id, permission_id) do nothing;

-- Delivery failures surface to the sender.
insert into notification_templates (event_type, language, title, body, priority) values
  ('messaging.failed', 'ar', 'فشل إرسال رسالة {{payload.channel}} إلى {{payload.to}}', '{{payload.error}}', 'high'),
  ('messaging.failed', 'en', '{{payload.channel}} message to {{payload.to}} failed', '{{payload.error}}', 'high')
on conflict (event_type, language) do nothing;

insert into notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
select 'messaging.failed', 'relation', 'creator', '{in_app}', true
where not exists (select 1 from notification_subscriptions s where s.event_type = 'messaging.failed' and s.relation = 'creator');
