-- Master upgrade Phase 16 (docs/bos/30 §23; doc 31): client portal extensions —
-- per-user permissions for client users, deployment status, maintenance &
-- support plans, client uploads, portal support conversations. Additive.

-- What each client user may see/do in the portal (default: everything the
-- portal offers, as before). Staff edit these on the account page.
alter table client_portal_users add column if not exists permissions jsonb not null default
  '{"projects":true,"approvals":true,"change_requests":true,"invoices":true,"payments":true,"contracts":true,"documents":true,"support":true,"messages":true,"meetings":true,"files":true,"upload":true}'::jsonb;

create table project_deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  environment text not null default 'production' check (environment in ('production','staging','testing','other')),
  version text,
  url text check (url is null or url ~ '^https?://'),
  status text not null default 'planned' check (status in ('planned','in_progress','deployed','failed','rolled_back')),
  scheduled_at timestamptz,
  deployed_at timestamptz,
  notes text,
  client_visible boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_deployments_project_idx on project_deployments (project_id, created_at desc);
create trigger project_deployments_touch before update on project_deployments for each row execute function bos_touch_updated_at();

create table support_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  name text not null,
  status text not null default 'active' check (status in ('active','paused','expired','cancelled')),
  starts_on date not null,
  ends_on date,
  monthly_hours numeric(8,2) check (monthly_hours is null or monthly_hours >= 0),
  response_hours int check (response_hours is null or response_hours between 1 and 720),
  includes text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create index support_plans_client_idx on support_plans (client_id);
create trigger support_plans_touch before update on support_plans for each row execute function bos_touch_updated_at();

alter table project_deployments enable row level security;
alter table support_plans enable row level security;
grant all on project_deployments, support_plans to service_role;

-- Second isolation layer for portal reads (primary filters are in the service).
create policy "portal reads own visible deployments" on project_deployments for select to authenticated
  using (client_visible and exists (select 1 from projects p where p.id = project_id and p.client_id = portal_client_id()));
create policy "portal reads own support plans" on support_plans for select to authenticated
  using (client_id = portal_client_id());
grant select on project_deployments, support_plans to authenticated;

insert into notification_templates (event_type, language, title, body, priority) values
  ('portal.file_uploaded', 'ar', 'ملف جديد من العميل: {{payload.name}}', '{{payload.client}}', 'normal'),
  ('portal.file_uploaded', 'en', 'New file from client: {{payload.name}}', '{{payload.client}}', 'normal'),
  ('deployment.updated', 'ar', 'تحديث النشر: {{payload.title}}', '{{payload.status}}', 'normal'),
  ('deployment.updated', 'en', 'Deployment update: {{payload.title}}', '{{payload.status}}', 'normal')
on conflict (event_type, language) do nothing;
