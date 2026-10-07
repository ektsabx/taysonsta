-- Master upgrade Phase 4 (docs/bos/30 §7, doc 31): Integration Hub.
-- Credentials are stored ENCRYPTED (AES-256-GCM, key only in the server
-- environment as BOS_SECRETS_KEY); the database never sees plaintext and no
-- API route ever returns it. Several accounts per provider are allowed.

create table integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z0-9_]{2,40}$'),
  label text not null,
  status text not null default 'active' check (status in ('active','disabled','error')),
  is_default boolean not null default false,
  config jsonb not null default '{}'::jsonb,          -- non-secret settings (from address, model, phone id…)
  secret_ciphertext text,                             -- base64(iv || ciphertext+tag)
  secret_hint jsonb not null default '{}'::jsonb,     -- per field: last 4 characters only
  secret_key_version int not null default 1,
  last_tested_at timestamptz,
  last_test_ok boolean,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index integration_connections_default_idx on integration_connections (provider) where is_default and status <> 'disabled';
create index integration_connections_provider_idx on integration_connections (provider, status);
create trigger integration_connections_touch before update on integration_connections for each row execute function bos_touch_updated_at();

-- Every outbound call / test / webhook, redacted (no secrets, no bodies with PII beyond ids).
create table integration_logs (
  id bigint generated always as identity primary key,
  connection_id uuid references integration_connections(id) on delete set null,
  provider text not null,
  direction text not null check (direction in ('outbound','inbound','test')),
  operation text not null,
  ok boolean not null,
  http_status int,
  duration_ms int,
  attempts int not null default 1,
  error text,
  meta jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index integration_logs_provider_idx on integration_logs (provider, created_at desc);
create index integration_logs_failed_idx on integration_logs (created_at desc) where not ok;

-- Inbound webhooks: signature result + idempotency on (provider, event_id).
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  connection_id uuid references integration_connections(id) on delete set null,
  event_id text not null,
  event_type text,
  signature_ok boolean not null,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  attempts int not null default 0,
  error text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);
create index webhook_events_status_idx on webhook_events (status, received_at desc);

-- AI usage and cost per call (unified AI client).
create table ai_usage_log (
  id bigint generated always as identity primary key,
  connection_id uuid references integration_connections(id) on delete set null,
  provider text not null,
  model text not null,
  feature text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_micros bigint not null default 0,      -- USD × 1,000,000
  ok boolean not null,
  fallback_from text,
  error text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index ai_usage_log_month_idx on ai_usage_log (created_at desc);

alter table integration_connections enable row level security;
alter table integration_logs enable row level security;
alter table webhook_events enable row level security;
alter table ai_usage_log enable row level security;
grant all on integration_connections, integration_logs, webhook_events, ai_usage_log to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Permissions: integrations module (admins manage; executive/finance read usage).
insert into permissions (key, module, action, description)
select 'integrations.' || a::text, 'integrations', a, 'Integrations — ' || replace(a::text, '_', ' ')
from unnest(enum_range(null::permission_action)) as a
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from roles r join permissions p on p.module = 'integrations'
where (r.key in ('super_admin','admin'))
   or (r.key in ('executive','finance') and p.action::text = 'read')
on conflict (role_id, permission_id) do nothing;
