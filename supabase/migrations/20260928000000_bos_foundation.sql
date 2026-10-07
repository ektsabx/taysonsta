-- Taysonsta BOS — Phase 1 foundation.
-- See docs/bos/02-database.md §3. Every BOS table has RLS enabled with no
-- anon/authenticated grants: staff access goes through the service-role
-- client after requirePermission() on the server (same pattern as the
-- existing CRM/careers tables). Client-portal policies are added in the
-- support/portal migration.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.bos_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type permission_action as enum ('create','read','update','delete','approve','export','assign','manage','view_sensitive');
create type permission_scope as enum ('own','assigned','team','all');
create type employment_type as enum ('full_time','part_time','contractor','intern','freelancer');
create type employee_lifecycle_status as enum ('candidate','hired','pending_onboarding','onboarding','active','on_leave','suspended','offboarding','archived');
create type mfa_status as enum ('required','not_configured','pending','enabled','disabled','recovery_required');
create type priority_level as enum ('low','medium','high','urgent');
create type approval_type as enum ('proposal','contract','design','scope','change_request','invoice','final_delivery','leave','expense','access_request','attendance_correction','overtime','milestone');
create type approval_status as enum ('pending','approved','rejected','cancelled','superseded');

-- ---------------------------------------------------------------------------
-- Currencies, settings, sequences
-- ---------------------------------------------------------------------------

create table currencies (
  code char(3) primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  symbol text not null,
  decimals smallint not null default 2 check (decimals between 0 and 3),
  is_active boolean not null default true
);

insert into currencies (code, name, symbol, decimals) values
  ('USD', 'US Dollar', '$', 2),
  ('SAR', 'Saudi Riyal', 'SAR', 2),
  ('AED', 'UAE Dirham', 'AED', 2),
  ('EGP', 'Egyptian Pound', 'EGP', 2),
  ('EUR', 'Euro', '€', 2),
  ('KWD', 'Kuwaiti Dinar', 'KWD', 3),
  ('QAR', 'Qatari Riyal', 'QAR', 2),
  ('GBP', 'British Pound', '£', 2);

create table exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base char(3) not null references currencies(code),
  quote char(3) not null references currencies(code),
  rate numeric(18,8) not null check (rate > 0),
  effective_date date not null,
  source text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (base, quote, effective_date),
  check (base <> quote)
);
create index exchange_rates_lookup_idx on exchange_rates (base, quote, effective_date desc);

create table bos_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into bos_settings (key, value) values
  ('company', '{"name":"Taysonsta","logo_path":null,"address":"","contact_email":"","contact_phone":"","tax_id":"","base_currency":"USD","timezone":"Africa/Cairo","email_domain":"taysonsta.com"}'),
  ('sales', '{"qualified_min_score":50,"require_payment_terms_for_won":true,"require_signed_contract_for_won":false,"deal_won_requires_approval":false}'),
  ('delivery', '{"pm_assignment":"round_robin","pm_user_id":null,"senior_pm_user_ids":[],"support_period_days":30}'),
  ('project_completion', '{"allow_complete_with_pending_payment":false,"allow_complete_with_pending_approvals":false}'),
  ('finance', '{"auto_send_first_invoice":false,"allow_overpayment":false,"default_payment_due_days":7,"profitability_revenue_basis":"collected"}'),
  ('attendance_policy', '{"forgotten_clock_out":{"auto_close_at_schedule_end":true,"require_employee_correction":true,"notify_employee":true,"notify_manager":true,"mark_requires_review":true},"auto_close_after_minutes":120,"expected_includes_break":true,"deduct_scheduled_break":false,"reminder_after_minutes":30,"lock_before_date":null}'),
  ('contracts', '{"store_signer_ip":true}'),
  ('security', '{"password_min_length":10,"session_timeout_minutes":720,"require_2fa_role_keys":["super_admin","admin","finance"],"login_max_attempts":5,"login_window_minutes":15}'),
  ('notifications', '{"meeting_reminder_minutes":30,"followup_reminder_minutes":60,"overdue_escalation_days":2}'),
  ('integrations', '{"email":{"enabled":false,"provider":null,"from":null},"calendar":{"enabled":false},"payment":{"enabled":false},"esign":{"enabled":false},"whatsapp":{"enabled":false},"scheduler":{"enabled":false},"push":{"enabled":false},"webhooks":{"enabled":false,"allowed_domains":[]}}'),
  ('lead_routing', '{"strategy":"round_robin","role_key":"business_development","last_user_id":null}'),
  ('approval_policies', '{"proposal":{"required":false,"approver":"role:sales_manager"},"expense":{"required":true,"approver":"manager"},"leave":{"required":true,"approver":"manager"},"attendance_correction":{"required":true,"approver":"manager"},"overtime":{"required":true,"approver":"manager"},"access_request":{"steps":["manager","role:admin"]},"access_request_sensitive":{"steps":["manager","role:super_admin"]},"invoice":{"required":false,"approver":"role:finance"}}');

create table document_sequences (
  key text primary key,
  prefix text not null,
  next_value bigint not null default 1,
  padding smallint not null default 5
);

insert into document_sequences (key, prefix, padding) values
  ('lead', 'L-', 5),
  ('deal', 'D-', 5),
  ('project', 'P-', 5),
  ('invoice', 'INV-', 5),
  ('payment', 'PAY-', 5),
  ('contract', 'CT-', 5),
  ('ticket', 'T-', 5),
  ('bug', 'BUG-', 5),
  ('change_request', 'CR-', 5),
  ('employee', 'EMP-', 4);

create or replace function public.bos_next_number(seq_key text)
returns text
language plpgsql
as $$
declare
  v_prefix text;
  v_value bigint;
  v_padding smallint;
begin
  update document_sequences
     set next_value = next_value + 1
   where key = seq_key
  returning prefix, next_value - 1, padding into v_prefix, v_value, v_padding;

  if v_prefix is null then
    raise exception 'Unknown document sequence %', seq_key;
  end if;

  return v_prefix || lpad(v_value::text, v_padding, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------------

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  parent_id uuid references departments(id) on delete restrict,
  manager_user_id uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department_id uuid references departments(id) on delete restrict,
  lead_user_id uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, name)
);

create table work_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  work_days smallint[] not null check (cardinality(work_days) > 0 and work_days <@ array[0,1,2,3,4,5,6]::smallint[]),
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 60 check (break_minutes >= 0),
  timezone text not null default 'Africa/Cairo',
  grace_minutes integer not null default 15 check (grace_minutes between 0 and 240),
  half_day_minutes integer not null default 240 check (half_day_minutes >= 0),
  overtime_after_minutes integer not null default 0 check (overtime_after_minutes >= 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create unique index work_schedules_single_default_idx on work_schedules (is_default) where is_default;

insert into work_schedules (name, work_days, start_time, end_time, break_minutes, timezone, grace_minutes, is_default)
values ('Default (Sun–Thu 10:00–18:00)', array[0,1,2,3,4]::smallint[], '10:00', '18:00', 60, 'Africa/Cairo', 15, true);

create table employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  employee_code text unique,
  full_name text not null check (length(trim(full_name)) > 0),
  photo_path text,
  email text,
  personal_email text,
  phone text,
  position text,
  department_id uuid references departments(id) on delete restrict,
  team_id uuid references teams(id) on delete restrict,
  manager_id uuid references employees(id) on delete set null,
  start_date date,
  employment_type employment_type not null default 'full_time',
  lifecycle_status employee_lifecycle_status not null default 'pending_onboarding',
  work_schedule_id uuid references work_schedules(id) on delete set null,
  country text,
  timezone text not null default 'Africa/Cairo',
  is_remote boolean not null default true,
  hourly_cost numeric(14,3) check (hourly_cost is null or hourly_cost >= 0),
  cost_currency char(3) references currencies(code),
  career_application_id uuid references career_applications(id) on delete set null,
  mfa_status mfa_status not null default 'not_configured',
  last_activity_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (manager_id is null or manager_id <> id)
);
create unique index employees_email_idx on employees (lower(email)) where email is not null;
create index employees_department_idx on employees (department_id);
create index employees_team_idx on employees (team_id);
create index employees_manager_idx on employees (manager_id);
create index employees_lifecycle_idx on employees (lifecycle_status);

-- ---------------------------------------------------------------------------
-- Roles & permissions
-- ---------------------------------------------------------------------------

create table roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z_]+$'),
  name text not null,
  description text,
  is_system boolean not null default false,
  is_client_role boolean not null default false,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  module text not null,
  action permission_action not null,
  description text,
  unique (module, action)
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  scope permission_scope not null default 'all',
  primary key (role_id, permission_id)
);

create table user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index user_roles_role_idx on user_roles (role_id);

create table user_permission_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  effect text not null check (effect in ('grant','deny')),
  scope permission_scope not null default 'own',
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

-- ---------------------------------------------------------------------------
-- Audit log (immutable), events, status history
-- ---------------------------------------------------------------------------

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  actor_type text not null default 'user' check (actor_type in ('user','system','client','automation')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  ip inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on audit_logs (actor_user_id, created_at desc);
create index audit_logs_action_idx on audit_logs (action, created_at desc);
create index audit_logs_created_idx on audit_logs (created_at desc);

create or replace function public.bos_audit_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs rows are immutable';
end;
$$;

create trigger audit_logs_no_update before update on audit_logs for each row execute function bos_audit_immutable();
create trigger audit_logs_no_delete before delete on audit_logs for each row execute function bos_audit_immutable();
create trigger audit_logs_no_truncate before truncate on audit_logs for each statement execute function bos_audit_immutable();

create table activity_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  actor_user_id uuid,
  actor_type text not null default 'user' check (actor_type in ('user','system','client','automation')),
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  visibility text not null default 'internal' check (visibility in ('internal','client')),
  dedupe_key text unique,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz
);
create index activity_events_entity_idx on activity_events (entity_type, entity_id, occurred_at desc);
create index activity_events_type_idx on activity_events (event_type, occurred_at desc);
create index activity_events_actor_idx on activity_events (actor_user_id, occurred_at desc);
create index activity_events_unprocessed_idx on activity_events (id) where processed_at is null;

create table activity_event_links (
  event_id bigint not null references activity_events(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  primary key (event_id, entity_type, entity_id)
);
create index activity_event_links_entity_idx on activity_event_links (entity_type, entity_id, event_id desc);

create table status_history (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid,
  reason text,
  changed_at timestamptz not null default now()
);
create index status_history_entity_idx on status_history (entity_type, entity_id, changed_at);

-- ---------------------------------------------------------------------------
-- Comments, files, saved views
-- ---------------------------------------------------------------------------

create table comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  parent_id uuid references comments(id) on delete cascade,
  body text not null check (length(body) between 1 and 20000),
  is_internal boolean not null default true,
  author_user_id uuid references auth.users(id) on delete set null,
  author_contact_id uuid,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (author_user_id is not null or author_contact_id is not null)
);
create index comments_entity_idx on comments (entity_type, entity_id, created_at);

create table files (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  name text not null check (length(trim(name)) > 0),
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  entity_type text,
  entity_id uuid,
  folder text not null default '/',
  version integer not null default 1 check (version > 0),
  previous_version_id uuid references files(id) on delete set null,
  is_latest boolean not null default true,
  is_template boolean not null default false,
  client_visible boolean not null default false,
  is_finalized boolean not null default false,
  uploaded_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index files_entity_idx on files (entity_type, entity_id) where deleted_at is null;
create index files_uploaded_by_idx on files (uploaded_by);
create index files_name_trgm_idx on files using gin (name extensions.gin_trgm_ops);

create table file_shares (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references files(id) on delete cascade,
  shared_with_user_id uuid references auth.users(id) on delete cascade,
  shared_with_role_id uuid references roles(id) on delete cascade,
  shared_with_client_id uuid references clients(id) on delete cascade,
  permission text not null default 'view' check (permission in ('view','edit')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(shared_with_user_id, shared_with_role_id, shared_with_client_id) = 1)
);
create index file_shares_file_idx on file_shares (file_id);
create index file_shares_user_idx on file_shares (shared_with_user_id);

create table saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  sort jsonb not null default '{}'::jsonb,
  columns jsonb not null default '[]'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, module, name)
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table bos_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id bigint references activity_events(id) on delete set null,
  event_type text not null,
  title text not null,
  body text,
  link text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index bos_notifications_user_idx on bos_notifications (user_id, read_at, created_at desc);
create unique index bos_notifications_user_event_idx on bos_notifications (user_id, event_id) where event_id is not null;

create table notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  subscriber_kind text not null check (subscriber_kind in ('role','user','relation')),
  role_id uuid references roles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  relation text check (relation in ('assignee','owner','creator','pm','bd','account_manager','manager_of_actor','manager_of_assignee','project_members','approver','employee','previous_assignee')),
  channels text[] not null default array['in_app']::text[] check (channels <@ array['in_app','email','push']::text[]),
  user_configurable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (subscriber_kind = 'role' and role_id is not null) or
    (subscriber_kind = 'user' and user_id is not null) or
    (subscriber_kind = 'relation' and relation is not null)
  )
);
create index notification_subscriptions_event_idx on notification_subscriptions (event_type) where is_active;

create table notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  in_app boolean not null default true,
  email boolean not null default true,
  push boolean not null default false,
  primary key (user_id, event_type)
);

create table notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references bos_notifications(id) on delete cascade,
  channel text not null check (channel in ('email','push')),
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)
);
create index notification_deliveries_queue_idx on notification_deliveries (status, created_at) where status = 'queued';

-- ---------------------------------------------------------------------------
-- Approvals (generic engine)
-- ---------------------------------------------------------------------------

create table approvals (
  id uuid primary key default gen_random_uuid(),
  approval_type approval_type not null,
  entity_type text not null,
  entity_id uuid not null,
  title text not null,
  group_id uuid not null default gen_random_uuid(),
  step smallint not null default 1 check (step > 0),
  total_steps smallint not null default 1 check (total_steps >= step),
  requested_by uuid references auth.users(id) on delete set null,
  requested_by_contact_id uuid,
  approver_user_id uuid references auth.users(id) on delete set null,
  approver_role_id uuid references roles(id) on delete set null,
  approver_contact_id uuid,
  status approval_status not null default 'pending',
  version integer not null default 1 check (version > 0),
  client_visible boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by_user_id uuid references auth.users(id) on delete set null,
  decided_by_contact_id uuid,
  decision_comment text,
  unique (group_id, step),
  check (num_nonnulls(approver_user_id, approver_role_id, approver_contact_id) >= 1)
);
create index approvals_entity_idx on approvals (entity_type, entity_id);
create index approvals_pending_user_idx on approvals (approver_user_id) where status = 'pending';
create index approvals_pending_role_idx on approvals (approver_role_id) where status = 'pending';
create index approvals_requested_by_idx on approvals (requested_by);

-- ---------------------------------------------------------------------------
-- Dashboards, login history, rate limits
-- ---------------------------------------------------------------------------

create table dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  role_id uuid references roles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  widgets jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  check (num_nonnulls(role_id, user_id) = 1)
);
create unique index dashboard_layouts_role_idx on dashboard_layouts (role_id) where role_id is not null;
create unique index dashboard_layouts_user_idx on dashboard_layouts (user_id) where user_id is not null;

create table login_history (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  success boolean not null,
  failure_reason text,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index login_history_user_idx on login_history (user_id, created_at desc);
create index login_history_email_idx on login_history (lower(email), created_at desc);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create or replace function public.bos_rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into rate_limits (key, window_start, count) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into v_count;

  delete from rate_limits where window_start < now() - interval '1 day';

  return v_count <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger departments_touch before update on departments for each row execute function bos_touch_updated_at();
create trigger teams_touch before update on teams for each row execute function bos_touch_updated_at();
create trigger work_schedules_touch before update on work_schedules for each row execute function bos_touch_updated_at();
create trigger employees_touch before update on employees for each row execute function bos_touch_updated_at();
create trigger roles_touch before update on roles for each row execute function bos_touch_updated_at();
create trigger files_touch before update on files for each row execute function bos_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Storage bucket for BOS files (private; served only via signed URLs)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('bos-files', 'bos-files', false, 52428800)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS: deny by default
-- ---------------------------------------------------------------------------

alter table currencies enable row level security;
alter table exchange_rates enable row level security;
alter table bos_settings enable row level security;
alter table document_sequences enable row level security;
alter table departments enable row level security;
alter table teams enable row level security;
alter table work_schedules enable row level security;
alter table employees enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table user_roles enable row level security;
alter table user_permission_overrides enable row level security;
alter table audit_logs enable row level security;
alter table activity_events enable row level security;
alter table activity_event_links enable row level security;
alter table status_history enable row level security;
alter table comments enable row level security;
alter table files enable row level security;
alter table file_shares enable row level security;
alter table saved_views enable row level security;
alter table bos_notifications enable row level security;
alter table notification_subscriptions enable row level security;
alter table notification_preferences enable row level security;
alter table notification_deliveries enable row level security;
alter table approvals enable row level security;
alter table dashboard_layouts enable row level security;
alter table login_history enable row level security;
alter table rate_limits enable row level security;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.bos_next_number(text), public.bos_rate_limit_hit(text, integer, integer) to service_role;
revoke execute on function public.bos_next_number(text), public.bos_rate_limit_hit(text, integer, integer) from public, anon, authenticated;
