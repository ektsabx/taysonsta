-- Master upgrade Phase 12 (docs/bos/30 §14–15; doc 31): advertising analytics
-- — read-only. Ad accounts → campaigns → ad sets → ads (+ link to the organic
-- social post when the creative really is that post), daily insights with
-- source + sync time, alert rules. No write-back to ad platforms. Additive.

create table ad_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('meta','google','linkedin','tiktok','snapchat','x','other')),
  mode text not null default 'api' check (mode in ('api','import')),
  connection_id uuid references integration_connections(id) on delete set null,
  external_id text,
  name text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  timezone text,
  status text,
  is_active boolean not null default true,
  last_sync_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ad_accounts_external_idx on ad_accounts (platform, external_id) where external_id is not null;
create trigger ad_accounts_touch before update on ad_accounts for each row execute function bos_touch_updated_at();

create table ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ad_accounts(id) on delete cascade,
  external_id text not null,
  name text not null,
  status text,
  objective text,
  daily_budget numeric(14,2),
  lifetime_budget numeric(14,2),
  start_at timestamptz,
  end_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (account_id, external_id)
);

create table ad_sets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  external_id text not null,
  name text not null,
  status text,
  daily_budget numeric(14,2),
  updated_at timestamptz not null default now(),
  unique (campaign_id, external_id)
);

create table ads (
  id uuid primary key default gen_random_uuid(),
  ad_set_id uuid references ad_sets(id) on delete cascade,
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  external_id text not null,
  name text not null,
  status text,
  creative_id text,
  creative_post_id text,                                  -- platform post the creative promotes (e.g. Meta effective_object_story_id)
  social_target_id uuid references social_post_targets(id) on delete set null,  -- set only when that post is one of ours
  updated_at timestamptz not null default now(),
  unique (campaign_id, external_id)
);

-- Daily numbers per level. Reach is stored per day but is NOT additive across
-- days (unique people) — the UI never sums it over multi-day ranges.
create table ad_insights_daily (
  level text not null check (level in ('campaign','ad')),
  object_id uuid not null,                                 -- ad_campaigns.id or ads.id
  account_id uuid not null references ad_accounts(id) on delete cascade,
  day date not null,
  currency text not null,
  spend numeric(14,2) not null default 0 check (spend >= 0),
  impressions bigint not null default 0,
  reach bigint,
  clicks bigint not null default 0,
  conversions numeric(14,2),                               -- null = platform/account doesn't report them
  conversion_value numeric(14,2),
  source text not null check (source in ('api','import')),
  fetched_at timestamptz not null default now(),
  primary key (level, object_id, day)
);
create index ad_insights_account_day_idx on ad_insights_daily (account_id, day);

create table ad_alert_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_id uuid references ad_accounts(id) on delete cascade,  -- null = every account
  metric text not null check (metric in ('daily_spend','cpa','ctr','roas','cpc')),
  comparator text not null check (comparator in ('gt','lt')),
  threshold numeric(14,4) not null check (threshold >= 0),
  notify_user_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  last_triggered_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table ad_accounts enable row level security;
alter table ad_campaigns enable row level security;
alter table ad_sets enable row level security;
alter table ads enable row level security;
alter table ad_insights_daily enable row level security;
alter table ad_alert_rules enable row level security;
grant all on ad_accounts, ad_campaigns, ad_sets, ads, ad_insights_daily, ad_alert_rules to service_role;

insert into permissions (key, module, action, description)
select 'ads.' || a::text, 'ads', a, 'Advertising analytics — ' || replace(a::text, '_', ' ')
from unnest(enum_range(null::permission_action)) as a
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'::permission_scope
from roles r join permissions p on p.module = 'ads'
where (r.key in ('super_admin','admin'))
   or (r.key = 'sales_manager' and p.action::text in ('read','export','manage'))
   or (r.key in ('executive','finance') and p.action::text in ('read','export'))
on conflict (role_id, permission_id) do nothing;

insert into notification_templates (event_type, language, title, body, priority) values
  ('ads.alert', 'ar', 'تنبيه إعلانات: {{payload.rule}}', '{{payload.detail}}', 'high'),
  ('ads.alert', 'en', 'Ads alert: {{payload.rule}}', '{{payload.detail}}', 'high'),
  ('ads.sync_failed', 'ar', 'فشل مزامنة حساب إعلانات: {{payload.account}}', '{{payload.error}}', 'normal'),
  ('ads.sync_failed', 'en', 'Ad account sync failed: {{payload.account}}', '{{payload.error}}', 'normal')
on conflict (event_type, language) do nothing;
