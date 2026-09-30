-- Taysonsta BOS — IT, Access & Employee Lifecycle.
-- The BOS records who should have access to which external tool and the
-- status/level granted; it never stores passwords or MFA secrets (IT §3,
-- §10, §11). Device security is company-asset compliance, not surveillance
-- (IT §13). See docs/bos/27-it-access-lifecycle.md.

create type access_status as enum ('not_started','requested','pending','provisioned','active','rejected','revoked','expired');
create type device_type as enum ('laptop','desktop','monitor','mobile','tablet','headset','other');
create type device_status as enum ('in_stock','assigned','in_repair','retired','lost');
create type device_security_status as enum ('compliant','warning','non_compliant','unknown');

create table external_apps (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+$'),
  name text not null unique,
  category text not null,
  provider text,
  url text,
  description text,
  owner_user_id uuid references auth.users(id) on delete set null,
  admin_user_id uuid references auth.users(id) on delete set null,
  security_requirements text,
  requires_mfa boolean not null default true,
  is_sensitive boolean not null default false,
  access_levels text[] not null default '{}',
  password_vault text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into external_apps (key, name, category, provider, url, requires_mfa, is_sensitive, access_levels, password_vault) values
  ('bos', 'Taysonsta BOS', 'Internal', 'Taysonsta', null, true, false, array['Employee','Manager','Admin'], null),
  ('company_email', 'Company Email (Google Workspace)', 'Productivity', 'Google', 'https://workspace.google.com', true, false, array['User','Admin'], null),
  ('google_calendar', 'Calendar (Google)', 'Productivity', 'Google', 'https://calendar.google.com', false, false, '{}', null),
  ('microsoft_365', 'Microsoft 365', 'Productivity', 'Microsoft', 'https://www.office.com', true, false, array['User','Admin'], null),
  ('slack', 'Slack', 'Communication', 'Slack', 'https://slack.com', true, false, array['Member','Admin'], null),
  ('zoom', 'Zoom', 'Meetings', 'Zoom', 'https://zoom.us', false, false, array['Basic','Licensed','Admin'], null),
  ('google_meet', 'Google Meet', 'Meetings', 'Google', 'https://meet.google.com', false, false, '{}', null),
  ('whatsapp_business', 'WhatsApp Business', 'Communication', 'Meta', 'https://business.whatsapp.com', true, false, array['Agent','Admin'], null),
  ('linkedin', 'LinkedIn (company-managed use)', 'Prospecting', 'LinkedIn', 'https://www.linkedin.com', true, false, array['Member','Sales Navigator'], null),
  ('apollo', 'Apollo', 'Prospecting', 'Apollo.io', 'https://www.apollo.io', true, false, array['User','Admin'], 'Taysonsta Sales Vault'),
  ('github', 'GitHub', 'Development', 'GitHub', 'https://github.com', true, true, array['Viewer','Contributor','Developer','Maintainer','Admin'], 'Taysonsta Engineering Vault'),
  ('gitlab', 'GitLab', 'Development', 'GitLab', 'https://gitlab.com', true, true, array['Guest','Reporter','Developer','Maintainer','Owner'], 'Taysonsta Engineering Vault'),
  ('figma', 'Figma', 'Design', 'Figma', 'https://www.figma.com', true, false, array['Viewer','Editor','Admin'], 'Taysonsta Design Vault'),
  ('adobe', 'Adobe Creative Cloud', 'Design', 'Adobe', 'https://www.adobe.com', true, false, array['User','Admin'], 'Taysonsta Design Vault'),
  ('cloud_provider', 'Cloud Provider', 'Infrastructure', null, null, true, true, array['Read-only','Developer','Admin'], 'Taysonsta Engineering Vault'),
  ('payment_provider', 'Payment Provider', 'Finance', null, null, true, true, array['Viewer','Operator','Admin'], 'Taysonsta Finance Vault'),
  ('banking', 'Banking', 'Finance', null, null, true, true, array['Viewer','Initiator','Approver'], 'Taysonsta Finance Vault'),
  ('accounting', 'Accounting Tool', 'Finance', null, null, true, true, array['Viewer','Accountant','Admin'], 'Taysonsta Finance Vault'),
  ('analytics', 'Analytics Tools', 'Analytics', null, null, false, false, array['Viewer','Editor','Admin'], null),
  ('hosting', 'Hosting', 'Infrastructure', null, null, true, true, array['Viewer','Admin'], 'Taysonsta Engineering Vault'),
  ('domain_provider', 'Domain Provider', 'Infrastructure', null, null, true, true, array['Viewer','Admin'], 'Taysonsta Engineering Vault');

create table role_app_requirements (
  role_id uuid not null references roles(id) on delete cascade,
  app_id uuid not null references external_apps(id) on delete cascade,
  default_access_level text,
  is_required boolean not null default true,
  primary key (role_id, app_id)
);

-- Role tool profiles (IT §6). Editable in Settings → IT & Access.
insert into role_app_requirements (role_id, app_id, default_access_level)
select r.id, a.id, x.level
from (values
  ('business_development', 'company_email', 'User'), ('business_development', 'bos', 'Employee'),
  ('business_development', 'google_calendar', null), ('business_development', 'google_meet', null),
  ('business_development', 'apollo', 'User'), ('business_development', 'linkedin', 'Member'),
  ('business_development', 'whatsapp_business', 'Agent'),
  ('sales_manager', 'company_email', 'User'), ('sales_manager', 'bos', 'Manager'), ('sales_manager', 'google_calendar', null),
  ('sales_manager', 'google_meet', null), ('sales_manager', 'apollo', 'Admin'), ('sales_manager', 'linkedin', 'Sales Navigator'),
  ('project_manager', 'company_email', 'User'), ('project_manager', 'bos', 'Manager'), ('project_manager', 'google_calendar', null),
  ('project_manager', 'google_meet', null), ('project_manager', 'slack', 'Member'),
  ('designer', 'company_email', 'User'), ('designer', 'bos', 'Employee'), ('designer', 'google_calendar', null),
  ('designer', 'figma', 'Editor'), ('designer', 'adobe', 'User'),
  ('developer', 'company_email', 'User'), ('developer', 'bos', 'Employee'), ('developer', 'github', 'Developer'),
  ('developer', 'cloud_provider', 'Developer'), ('developer', 'slack', 'Member'),
  ('qa', 'company_email', 'User'), ('qa', 'bos', 'Employee'), ('qa', 'github', 'Contributor'),
  ('finance', 'company_email', 'User'), ('finance', 'bos', 'Employee'), ('finance', 'payment_provider', 'Operator'),
  ('finance', 'banking', 'Viewer'), ('finance', 'accounting', 'Accountant'),
  ('hr', 'company_email', 'User'), ('hr', 'bos', 'Manager'), ('hr', 'google_calendar', null),
  ('support', 'company_email', 'User'), ('support', 'bos', 'Employee'), ('support', 'whatsapp_business', 'Agent'),
  ('account_manager', 'company_email', 'User'), ('account_manager', 'bos', 'Employee'), ('account_manager', 'google_calendar', null),
  ('account_manager', 'google_meet', null), ('account_manager', 'whatsapp_business', 'Agent'),
  ('product_manager', 'company_email', 'User'), ('product_manager', 'bos', 'Employee'), ('product_manager', 'figma', 'Viewer'),
  ('product_manager', 'github', 'Viewer'),
  ('executive', 'company_email', 'User'), ('executive', 'bos', 'Manager'), ('executive', 'google_calendar', null),
  ('admin', 'company_email', 'Admin'), ('admin', 'bos', 'Admin'),
  ('super_admin', 'company_email', 'Admin'), ('super_admin', 'bos', 'Admin')
) as x(role_key, app_key, level)
join roles r on r.key = x.role_key
join external_apps a on a.key = x.app_key;

create table company_accounts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete restrict,
  app_id uuid references external_apps(id) on delete set null,
  account_type text not null default 'app' check (account_type in ('email','sso','app','other')),
  provider text not null,
  identifier text not null,
  status access_status not null default 'not_started',
  last_access_at timestamptz,
  last_reviewed_at timestamptz,
  owner_user_id uuid references auth.users(id) on delete set null,
  recovery_owner_user_id uuid references auth.users(id) on delete set null,
  mfa_status mfa_status not null default 'required',
  mfa_method text,
  mfa_verified_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index company_accounts_identifier_idx on company_accounts (lower(provider), lower(identifier));
create index company_accounts_employee_idx on company_accounts (employee_id);

create table access_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete restrict,
  requested_by uuid references auth.users(id) on delete set null,
  app_id uuid not null references external_apps(id) on delete restrict,
  access_level text,
  reason text not null check (length(trim(reason)) > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  approval_group_id uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index access_requests_employee_idx on access_requests (employee_id, status);

create table access_grants (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete restrict,
  app_id uuid not null references external_apps(id) on delete restrict,
  access_level text,
  status access_status not null default 'not_started',
  is_required boolean not null default false,
  needs_review boolean not null default false,
  source text not null default 'manual' check (source in ('role_profile','request','manual')),
  vault text,
  request_id uuid references access_requests(id) on delete set null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, app_id)
);
create index access_grants_status_idx on access_grants (status);

create table devices (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null unique,
  type device_type not null,
  model text,
  serial_number text unique,
  os text,
  purchase_date date,
  warranty_until date,
  status device_status not null default 'in_stock',
  condition text not null default 'good' check (condition in ('new','good','fair','poor','damaged')),
  location text,
  assigned_employee_id uuid references employees(id) on delete restrict,
  assigned_at timestamptz,
  return_status text not null default 'not_applicable' check (return_status in ('not_applicable','pending_return','returned')),
  security_status device_security_status not null default 'unknown',
  os_updated boolean,
  encryption_enabled boolean,
  screen_lock_enabled boolean,
  antivirus_enabled boolean,
  company_account_configured boolean,
  last_security_check_at timestamptz,
  mdm_provider text,
  mdm_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (warranty_until is null or purchase_date is null or warranty_until >= purchase_date),
  check ((status = 'assigned') = (assigned_employee_id is not null))
);
create index devices_employee_idx on devices (assigned_employee_id);

create table device_assignments (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  confirmed_by_employee_at timestamptz,
  returned_at timestamptz,
  condition_out text,
  condition_in text
);
create index device_assignments_device_idx on device_assignments (device_id, assigned_at desc);
create index device_assignments_employee_idx on device_assignments (employee_id);

-- Compliance from the individual checks (unknown values ⇒ unknown/warning).
create or replace function public.bos_device_compliance()
returns trigger
language plpgsql
as $$
declare
  v_checks boolean[] := array[new.os_updated, new.encryption_enabled, new.screen_lock_enabled, new.antivirus_enabled, new.company_account_configured];
begin
  if new.type in ('monitor','headset') then
    new.security_status := 'compliant';
  elsif false = any(v_checks) then
    new.security_status := case when new.encryption_enabled is false or new.screen_lock_enabled is false then 'non_compliant' else 'warning' end;
  elsif array_position(v_checks, null) is not null then
    new.security_status := case when array_position(v_checks, true) is null then 'unknown' else 'warning' end;
  else
    new.security_status := 'compliant';
  end if;
  return new;
end;
$$;

create trigger devices_compliance before insert or update of os_updated, encryption_enabled, screen_lock_enabled, antivirus_enabled, company_account_configured, type
on devices for each row execute function bos_device_compliance();

-- Access checklist from role profiles (IT §7). Idempotent; role changes add
-- new required apps and flag no-longer-required ones for review.
create or replace function public.bos_generate_access_checklist(p_employee uuid, p_actor uuid)
returns integer
language plpgsql
as $$
declare
  v_emp employees%rowtype;
  v_n integer;
begin
  select * into v_emp from employees where id = p_employee;
  if v_emp.id is null then
    raise exception 'Employee not found' using errcode = 'P0002';
  end if;

  with required as (
    select distinct on (rar.app_id) rar.app_id, rar.default_access_level, a.password_vault
    from role_app_requirements rar
    join user_roles ur on ur.role_id = rar.role_id and ur.user_id = v_emp.user_id
    join external_apps a on a.id = rar.app_id and a.is_active
    where rar.is_required
    order by rar.app_id, array_position(a.access_levels, rar.default_access_level) desc nulls last
  ), base as (
    select id as app_id, case when key = 'bos' then 'Employee' else 'User' end as default_access_level, password_vault
    from external_apps where key in ('bos','company_email') and is_active
  ), all_required as (
    select * from required
    union all
    select * from base where app_id not in (select app_id from required)
  ), ins as (
    insert into access_grants (employee_id, app_id, access_level, status, is_required, source, vault)
    select p_employee, r.app_id, r.default_access_level, 'not_started', true, 'role_profile', r.password_vault
    from all_required r
    on conflict (employee_id, app_id) do update set is_required = true, needs_review = false
    returning 1
  )
  select count(*) into v_n from ins;

  update access_grants g set needs_review = true, is_required = false
   where g.employee_id = p_employee and g.source = 'role_profile' and g.is_required
     and g.app_id not in (
       select rar.app_id from role_app_requirements rar join user_roles ur on ur.role_id = rar.role_id and ur.user_id = v_emp.user_id where rar.is_required
       union select id from external_apps where key in ('bos','company_email'));

  if v_emp.user_id is not null then
    update access_grants set status = 'active', granted_at = coalesce(granted_at, now())
     where employee_id = p_employee and status in ('not_started','requested','pending','provisioned')
       and app_id = (select id from external_apps where key = 'bos');
  end if;

  perform bos_audit(p_actor, 'access.checklist_generated', 'employee', p_employee, null, jsonb_build_object('items', v_n));
  return v_n;
end;
$$;

create trigger external_apps_touch before update on external_apps for each row execute function bos_touch_updated_at();
create trigger company_accounts_touch before update on company_accounts for each row execute function bos_touch_updated_at();
create trigger access_grants_touch before update on access_grants for each row execute function bos_touch_updated_at();
create trigger devices_touch before update on devices for each row execute function bos_touch_updated_at();

alter table external_apps enable row level security;
alter table role_app_requirements enable row level security;
alter table company_accounts enable row level security;
alter table access_requests enable row level security;
alter table access_grants enable row level security;
alter table devices enable row level security;
alter table device_assignments enable row level security;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

revoke execute on function public.bos_generate_access_checklist(uuid, uuid) from public, anon, authenticated;
