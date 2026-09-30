-- Master upgrade Phase 10 (docs/bos/30 §12; doc 31): social media management
-- — accounts (API-connected or manual), content calendar, per-platform post
-- versions with approval, scheduled publishing with safe retry, metrics with
-- source + sync time. Additive only.

insert into document_sequences (key, prefix, padding) values ('social_post', 'SP-', 6) on conflict (key) do nothing;

create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('facebook','instagram','telegram','threads','linkedin','x','snapchat','tiktok','youtube','other')),
  mode text not null default 'manual' check (mode in ('api','manual')),  -- api = we publish/sync through the provider; manual = logged by staff
  connection_id uuid references integration_connections(id) on delete set null,
  external_id text,                                    -- page id / IG user id / @channel
  name text not null,
  handle text,
  avatar_url text,
  profile_url text,
  status text not null default 'connected' check (status in ('connected','error','disconnected','manual')),
  scopes text[] not null default '{}',
  token_enc text,                                      -- encrypted page/account token (AES-GCM, lib/bos/secrets)
  last_sync_at timestamptz,
  last_error text,
  connected_at timestamptz not null default now(),
  connected_by uuid references auth.users(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index social_accounts_external_idx on social_accounts (platform, external_id) where external_id is not null;
create trigger social_accounts_touch before update on social_accounts for each row execute function bos_touch_updated_at();

create table social_posts (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default bos_next_number('social_post'),
  title text not null,
  base_text text not null default '',
  hashtags text[] not null default '{}',
  media jsonb not null default '[]'::jsonb,            -- [{url, type: image|video, alt}]
  link_url text,
  status text not null default 'draft' check (status in ('draft','in_review','changes_requested','approved','scheduled','publishing','published','partially_published','failed','cancelled')),
  scheduled_at timestamptz,
  published_at timestamptz,
  owner_id uuid references auth.users(id) on delete set null,
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  content_id uuid,                                     -- Phase 11 content record
  campaign text,
  branch_id uuid references branches(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index social_posts_calendar_idx on social_posts (coalesce(scheduled_at, published_at, created_at));
create index social_posts_status_idx on social_posts (status, scheduled_at);
create trigger social_posts_touch before update on social_posts for each row execute function bos_touch_updated_at();

create table social_post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_posts(id) on delete cascade,
  account_id uuid not null references social_accounts(id) on delete restrict,
  text_override text,                                  -- per-platform version (null = base text)
  media_override jsonb,
  status text not null default 'pending' check (status in ('pending','publishing','published','failed','manual_pending','cancelled')),
  external_post_id text,                               -- set once published → never republished
  post_url text,
  error text,
  attempts int not null default 0,
  next_attempt_at timestamptz,
  published_at timestamptz,
  metrics_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, account_id)
);
create trigger social_post_targets_touch before update on social_post_targets for each row execute function bos_touch_updated_at();

-- Post metrics: one row per target × metric; source + time of the value.
create table social_post_metrics (
  target_id uuid not null references social_post_targets(id) on delete cascade,
  metric text not null,
  value numeric not null check (value >= 0),
  source text not null check (source in ('api','manual')),
  recorded_by uuid references auth.users(id) on delete set null,
  fetched_at timestamptz not null default now(),
  primary key (target_id, metric)
);

-- Account-level daily numbers (followers …).
create table social_account_metrics (
  account_id uuid not null references social_accounts(id) on delete cascade,
  day date not null,
  metric text not null,
  value numeric not null check (value >= 0),
  source text not null check (source in ('api','manual')),
  fetched_at timestamptz not null default now(),
  primary key (account_id, day, metric)
);

alter table social_accounts enable row level security;
alter table social_posts enable row level security;
alter table social_post_targets enable row level security;
alter table social_post_metrics enable row level security;
alter table social_account_metrics enable row level security;
grant all on social_accounts, social_posts, social_post_targets, social_post_metrics, social_account_metrics to service_role;

insert into permissions (key, module, action, description)
select 'social.' || a::text, 'social', a, 'Social media — ' || replace(a::text, '_', ' ')
from unnest(enum_range(null::permission_action)) as a
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, (case when r.key in ('super_admin','admin','executive','sales_manager') then 'all' else 'own' end)::permission_scope
from roles r join permissions p on p.module = 'social'
where (r.key in ('super_admin','admin'))
   or (r.key = 'sales_manager' and p.action::text in ('read','create','update','approve','manage','export'))
   or (r.key = 'designer' and p.action::text in ('read','create','update'))
   or (r.key in ('executive') and p.action::text in ('read','export'))
   or (r.key in ('business_development','account_manager') and p.action::text in ('read'))
on conflict (role_id, permission_id) do nothing;

insert into notification_templates (event_type, language, title, body, priority) values
  ('social.post_submitted', 'ar', 'منشور بانتظار المراجعة: {{payload.title}}', null, 'normal'),
  ('social.post_submitted', 'en', 'Post awaiting review: {{payload.title}}', null, 'normal'),
  ('social.post_reviewed', 'ar', 'نتيجة مراجعة المنشور: {{payload.title}}', '{{payload.note}}', 'normal'),
  ('social.post_reviewed', 'en', 'Post review result: {{payload.title}}', '{{payload.note}}', 'normal'),
  ('social.publish_failed', 'ar', 'فشل نشر: {{payload.title}}', '{{payload.error}}', 'high'),
  ('social.publish_failed', 'en', 'Publishing failed: {{payload.title}}', '{{payload.error}}', 'high')
on conflict (event_type, language) do nothing;

insert into notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
select v.e, 'relation', v.r, '{in_app}', true
from (values ('social.post_reviewed','owner'), ('social.publish_failed','owner'), ('social.post_submitted','assignee')) as v(e, r)
where not exists (select 1 from notification_subscriptions s where s.event_type = v.e and s.relation = v.r);

-- Telegram channels (Bot API) join the Integration Hub catalogue in code.
