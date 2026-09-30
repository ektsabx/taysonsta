-- HR & Workforce — people records (docs/bos/28 §6–10, §25, §31, §39).
-- Additive: extends employees, adds private data, compensation, job history,
-- separations, the employee file (documents) and employee contracts, and the
-- HR permission modules. No existing column or row is removed.

-- ---------------------------------------------------------------------------
-- Employee profile extensions
-- ---------------------------------------------------------------------------

create table employee_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table employees
  add column work_location text,
  add column category_id uuid references employee_categories(id) on delete set null,
  add column probation_end_date date,
  add column probation_status text not null default 'none' check (probation_status in ('none','in_probation','passed','extended','failed')),
  add column skills text[] not null default '{}',
  add column certifications text,
  add column qualifications text,
  add column experience_years numeric(4,1) check (experience_years is null or experience_years >= 0),
  add column profile_notes text,
  add column hourly_cost_source text not null default 'manual' check (hourly_cost_source in ('manual','salary')),
  add column photo_updated_at timestamptz;

-- Sensitive personal / legal / bank data: 1:1, read only by the employee
-- and holders of employees.view_sensitive (enforced in the service layer).
create table employee_private (
  employee_id uuid primary key references employees(id) on delete cascade,
  date_of_birth date,
  gender text check (gender is null or gender in ('male','female')),
  nationality text,
  marital_status text check (marital_status is null or marital_status in ('single','married','divorced','widowed')),
  address text,
  national_id text,
  national_id_expiry date,
  passport_number text,
  passport_expiry date,
  tax_id text,
  insurance_number text,
  insurance_start_date date,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_iban text,
  emergency_contact_name text,
  emergency_contact_relation text,
  emergency_contact_phone text,
  hr_notes text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Compensation (effective-dated → salary history / adjustments)
-- ---------------------------------------------------------------------------

create table salary_components (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+$'),
  name text not null,
  kind text not null check (kind in ('earning','deduction')),
  category text not null check (category in ('housing','transportation','allowance','other_earning','insurance','tax','other_deduction')),
  calc_type text not null default 'fixed' check (calc_type in ('fixed','percent_of_basic')),
  default_value numeric(14,3),
  taxable boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into salary_components (key, name, kind, category, calc_type, taxable, sort_order) values
  ('housing', 'بدل سكن', 'earning', 'housing', 'fixed', true, 10),
  ('transportation', 'بدل انتقال', 'earning', 'transportation', 'fixed', true, 20),
  ('communication', 'بدل اتصالات', 'earning', 'allowance', 'fixed', true, 30),
  ('meal', 'بدل وجبات', 'earning', 'allowance', 'fixed', false, 40),
  ('other_allowance', 'بدلات أخرى', 'earning', 'other_earning', 'fixed', true, 50),
  ('other_deduction', 'استقطاعات أخرى', 'deduction', 'other_deduction', 'fixed', false, 90)
on conflict (key) do nothing;

create table employee_compensation (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  effective_from date not null,
  basic_salary numeric(14,3) not null check (basic_salary >= 0),
  currency char(3) not null references currencies(code),
  pay_frequency text not null default 'monthly' check (pay_frequency in ('monthly')),
  change_type text not null default 'initial' check (change_type in ('initial','adjustment','promotion','correction')),
  reason text,
  approval_status text not null default 'approved' check (approval_status in ('pending','approved','rejected')),
  review_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index employee_compensation_emp_idx on employee_compensation (employee_id, effective_from desc);

create table employee_salary_components (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  component_id uuid not null references salary_components(id) on delete restrict,
  amount numeric(14,3) not null check (amount >= 0),
  effective_from date not null,
  effective_to date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
create index employee_salary_components_emp_idx on employee_salary_components (employee_id);

-- Current approved basic salary on a date.
create or replace function public.bos_employee_salary_on(p_employee uuid, p_date date)
returns employee_compensation
language sql
stable
as $$
  select * from employee_compensation
  where employee_id = p_employee and approval_status = 'approved' and effective_from <= p_date
  order by effective_from desc, created_at desc
  limit 1;
$$;

-- Optional link to project labor cost (§33): when hourly_cost_source =
-- 'salary', the hourly cost follows (basic + fixed earning components) /
-- standard monthly hours from the payroll policy.
create or replace function public.bos_sync_hourly_cost(p_employee uuid)
returns void
language plpgsql
as $$
declare
  v_emp employees%rowtype;
  v_comp employee_compensation%rowtype;
  v_extra numeric := 0;
  v_hours numeric := coalesce(((select value from bos_settings where key = 'payroll_policy')->'overtime'->>'standard_monthly_hours')::numeric, 176);
begin
  select * into v_emp from employees where id = p_employee;
  if v_emp.id is null or v_emp.hourly_cost_source <> 'salary' then return; end if;
  v_comp := bos_employee_salary_on(p_employee, current_date);
  if v_comp.id is null then return; end if;
  select coalesce(sum(case when c.calc_type = 'percent_of_basic' then v_comp.basic_salary * esc.amount / 100 else esc.amount end), 0)
    into v_extra
    from employee_salary_components esc join salary_components c on c.id = esc.component_id
   where esc.employee_id = p_employee and c.kind = 'earning'
     and esc.effective_from <= current_date and (esc.effective_to is null or esc.effective_to >= current_date);
  update employees set hourly_cost = round((v_comp.basic_salary + v_extra) / greatest(v_hours, 1), 3), cost_currency = v_comp.currency
   where id = p_employee;
end;
$$;

-- ---------------------------------------------------------------------------
-- Job history (promotion, transfer, salary adjustment…) and separations
-- ---------------------------------------------------------------------------

create table employee_job_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  effective_date date not null,
  change_type text not null check (change_type in ('hire','promotion','transfer','title_change','salary_adjustment','demotion','status_change')),
  from_position text,
  to_position text,
  from_department_id uuid references departments(id) on delete set null,
  to_department_id uuid references departments(id) on delete set null,
  from_team_id uuid references teams(id) on delete set null,
  to_team_id uuid references teams(id) on delete set null,
  from_manager_id uuid references employees(id) on delete set null,
  to_manager_id uuid references employees(id) on delete set null,
  compensation_id uuid references employee_compensation(id) on delete set null,
  review_id uuid,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index employee_job_history_emp_idx on employee_job_history (employee_id, effective_date desc);

create table employee_separations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  separation_type text not null check (separation_type in ('resignation','termination','end_of_contract','retirement','mutual','other')),
  notice_date date,
  last_working_day date,
  reason text,
  status text not null default 'in_progress' check (status in ('in_progress','completed','cancelled')),
  exit_interview_at timestamptz,
  exit_interview_by uuid references auth.users(id) on delete set null,
  exit_interview_notes text,
  rehire_eligible boolean,
  final_settlement_payslip_id uuid,
  initiated_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index employee_separations_open_idx on employee_separations (employee_id) where status = 'in_progress';

-- ---------------------------------------------------------------------------
-- Employee file: document register on top of the Files module (§8, §34)
-- ---------------------------------------------------------------------------

create table document_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+$'),
  name text not null,
  category text not null check (category in ('identity','employment','qualification','finance','insurance','tax','medical','performance','disciplinary','payroll','other')),
  requires_expiry boolean not null default false,
  alert_days_before integer not null default 30 check (alert_days_before between 0 and 365),
  required_for_onboarding boolean not null default false,
  employee_can_upload boolean not null default true,
  visible_to_employee boolean not null default true,
  visible_to_manager boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into document_types (key, name, category, requires_expiry, required_for_onboarding, employee_can_upload, visible_to_employee, visible_to_manager, sort_order) values
  ('cv', 'السيرة الذاتية', 'qualification', false, true, true, true, true, 10),
  ('job_offer', 'عرض العمل', 'employment', false, false, false, true, false, 20),
  ('offer_acceptance', 'قبول عرض العمل', 'employment', false, true, true, true, false, 30),
  ('employment_contract', 'عقد العمل', 'employment', true, false, false, true, false, 40),
  ('nda', 'اتفاقية السرية (NDA)', 'employment', false, true, true, true, false, 50),
  ('ip_agreement', 'اتفاقية الملكية الفكرية', 'employment', false, false, true, true, false, 60),
  ('national_id', 'بطاقة الرقم القومي', 'identity', true, true, true, true, false, 70),
  ('passport', 'جواز السفر', 'identity', true, false, true, true, false, 80),
  ('qualification', 'المؤهل الدراسي', 'qualification', false, true, true, true, true, 90),
  ('certificate', 'شهادة مهنية', 'qualification', true, false, true, true, true, 100),
  ('bank_document', 'مستند بنكي', 'finance', false, false, true, true, false, 110),
  ('insurance_document', 'مستند تأمينات', 'insurance', false, false, true, true, false, 120),
  ('tax_document', 'مستند ضريبي', 'tax', false, false, true, true, false, 130),
  ('medical', 'مستند طبي', 'medical', true, false, true, true, false, 140),
  ('performance_review', 'تقييم أداء', 'performance', false, false, false, true, true, 150),
  ('warning_letter', 'خطاب إنذار', 'disciplinary', false, false, false, true, true, 160),
  ('payslip', 'قسيمة راتب', 'payroll', false, false, false, true, false, 170),
  ('other', 'مستند آخر', 'other', false, false, true, true, false, 900)
on conflict (key) do nothing;

create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  document_type_id uuid not null references document_types(id) on delete restrict,
  title text not null,
  document_number text,
  issue_date date,
  expiry_date date,
  status text not null default 'pending_verification' check (status in ('pending_verification','valid','rejected','expired','archived')),
  confidential boolean not null default false,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  rejection_reason text,
  notes text,
  expiry_alerted_at timestamptz,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date)
);
create index employee_documents_emp_idx on employee_documents (employee_id);
create index employee_documents_expiry_idx on employee_documents (expiry_date) where status in ('valid','pending_verification');

-- ---------------------------------------------------------------------------
-- Employee contracts (§9–10): versions, renewals, amendments with history
-- ---------------------------------------------------------------------------

create table employee_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text unique,
  employee_id uuid not null references employees(id) on delete cascade,
  contract_type text not null check (contract_type in ('employment','renewal','amendment','probation','freelance','internship','nda','other')),
  title text not null,
  version integer not null default 1 check (version > 0),
  parent_id uuid references employee_contracts(id) on delete set null,
  start_date date not null,
  end_date date,
  status text not null default 'draft' check (status in ('draft','pending_signature','active','expired','terminated','superseded','cancelled')),
  signature_status text not null default 'pending' check (signature_status in ('pending','employee_signed','company_signed','signed')),
  employee_signed_at timestamptz,
  company_signed_at timestamptz,
  position_title text,
  basic_salary numeric(14,3),
  currency char(3) references currencies(code),
  notice_period_days integer check (notice_period_days is null or notice_period_days >= 0),
  terms text,
  notes text,
  termination_reason text,
  terminated_at timestamptz,
  expiry_alerted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index employee_contracts_emp_idx on employee_contracts (employee_id, version desc);
create index employee_contracts_end_idx on employee_contracts (end_date) where status = 'active';

insert into document_sequences (key, prefix, padding) values
  ('employee_contract', 'EC-', 5),
  ('payroll_run', 'PR-', 5),
  ('job_offer', 'OF-', 5),
  ('hr_request', 'HRQ-', 5),
  ('employee_loan', 'LN-', 5)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Triggers, RLS (service-role only; access enforced in the service layer)
-- ---------------------------------------------------------------------------

create trigger employee_private_touch before update on employee_private for each row execute function bos_touch_updated_at();
create trigger employee_documents_touch before update on employee_documents for each row execute function bos_touch_updated_at();
create trigger employee_contracts_touch before update on employee_contracts for each row execute function bos_touch_updated_at();
create trigger employee_separations_touch before update on employee_separations for each row execute function bos_touch_updated_at();

alter table employee_categories enable row level security;
alter table employee_private enable row level security;
alter table salary_components enable row level security;
alter table employee_compensation enable row level security;
alter table employee_salary_components enable row level security;
alter table employee_job_history enable row level security;
alter table employee_separations enable row level security;
alter table document_types enable row level security;
alter table employee_documents enable row level security;
alter table employee_contracts enable row level security;

-- ---------------------------------------------------------------------------
-- HR permission modules + HR Staff role (§31)
-- ---------------------------------------------------------------------------

insert into permissions (key, module, action, description)
select m || '.' || a::text, m, a, initcap(replace(m, '_', ' ')) || ' — ' || replace(a::text, '_', ' ')
from unnest(array['payroll','recruitment','hr_documents','hr_requests']) as m
cross join unnest(enum_range(null::permission_action)) as a
on conflict (key) do nothing;

insert into roles (key, name, description, is_system, is_client_role, sort_order)
values ('hr_staff', 'HR Staff', 'Employees, attendance, leave, documents and requests — no payroll or sensitive data.', true, false, 14)
on conflict (key) do nothing;

create function pg_temp.grant_perms(p_role text, p_modules text[], p_actions text[], p_scope permission_scope)
returns void
language sql
as $$
  insert into role_permissions (role_id, permission_id, scope)
  select r.id, p.id, p_scope
  from roles r
  join permissions p on p.module = any(p_modules) and p.action::text = any(p_actions)
  where r.key = p_role
  on conflict (role_id, permission_id) do update
    set scope = case
      when array_position(enum_range(null::permission_scope), excluded.scope) >
           array_position(enum_range(null::permission_scope), role_permissions.scope)
      then excluded.scope else role_permissions.scope end;
$$;

do $$
declare
  r text;
begin
  -- Self-service baseline for every staff role.
  foreach r in array array['super_admin','admin','executive','sales_manager','business_development','account_manager',
                           'project_manager','product_manager','designer','developer','qa','finance','hr','hr_staff','support']
  loop
    perform pg_temp.grant_perms(r, array['payroll'], array['read','create'], 'own');
    perform pg_temp.grant_perms(r, array['hr_documents','hr_requests'], array['read','create'], 'own');
  end loop;
end;
$$;

-- HR Staff mirrors the staff baseline of the original RBAC seed.
do $$
begin
  perform pg_temp.grant_perms('hr_staff', array['dashboard','calendar','search'], array['read'], 'own');
  perform pg_temp.grant_perms('hr_staff', array['tasks'], array['create','read','update'], 'assigned');
  perform pg_temp.grant_perms('hr_staff', array['timesheets'], array['create','read'], 'own');
  perform pg_temp.grant_perms('hr_staff', array['notifications'], array['read','update'], 'own');
  perform pg_temp.grant_perms('hr_staff', array['chat'], array['create','read'], 'assigned');
  perform pg_temp.grant_perms('hr_staff', array['knowledge'], array['read'], 'all');
  perform pg_temp.grant_perms('hr_staff', array['files'], array['create','read'], 'assigned');
  perform pg_temp.grant_perms('hr_staff', array['meetings'], array['read'], 'assigned');
  perform pg_temp.grant_perms('hr_staff', array['approvals'], array['read'], 'own');
  perform pg_temp.grant_perms('hr_staff', array['access'], array['create','read'], 'own');
  perform pg_temp.grant_perms('hr_staff', array['devices','commissions'], array['read'], 'own');
  perform pg_temp.grant_perms('hr_staff', array['employees'], array['read','create','update','export'], 'all');
  perform pg_temp.grant_perms('hr_staff', array['attendance','leave','overtime'], array['create','read','update','approve','export'], 'all');
  perform pg_temp.grant_perms('hr_staff', array['hr_documents','hr_requests'], array['create','read','update','approve','export'], 'all');
  perform pg_temp.grant_perms('hr_staff', array['recruitment'], array['create','read','update','export'], 'all');
  perform pg_temp.grant_perms('hr_staff', array['onboarding'], array['create','read','update'], 'all');
  perform pg_temp.grant_perms('hr_staff', array['kpis','performance'], array['read'], 'all');
  perform pg_temp.grant_perms('hr_staff', array['approvals'], array['approve'], 'all');
  perform pg_temp.grant_perms('hr_staff', array['reports'], array['read'], 'all');
end;
$$;

select pg_temp.grant_perms('super_admin', array['payroll','recruitment','hr_documents','hr_requests'], array(select unnest(enum_range(null::permission_action))::text), 'all');
select pg_temp.grant_perms('admin', array['payroll','recruitment','hr_documents','hr_requests'], array(select unnest(enum_range(null::permission_action))::text), 'all');
select pg_temp.grant_perms('executive', array['payroll','recruitment','hr_documents','hr_requests'], array['read','export'], 'all');
select pg_temp.grant_perms('executive', array['payroll'], array['view_sensitive'], 'all');
select pg_temp.grant_perms('hr', array['payroll'], array['create','read','update','export','manage','view_sensitive'], 'all');
select pg_temp.grant_perms('hr', array['recruitment','hr_documents','hr_requests'], array['create','read','update','delete','approve','export','manage','assign','view_sensitive'], 'all');
select pg_temp.grant_perms('finance', array['payroll'], array['create','read','update','approve','export','manage','view_sensitive'], 'all');
select pg_temp.grant_perms('finance', array['hr_requests'], array['read'], 'all');
select pg_temp.grant_perms('finance', array['employees'], array['view_sensitive'], 'all');

grant all on all tables in schema public to service_role;
revoke execute on function public.bos_employee_salary_on(uuid, date), public.bos_sync_hourly_cost(uuid) from public, anon, authenticated;
