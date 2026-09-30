-- HR & Workforce — payroll, bonuses, loans/advances, employee expenses and
-- other employee requests (docs/bos/28 §16–19, §26, §32). Payroll posts to
-- the existing Finance `expenses` table — no second finance ledger.

-- ---------------------------------------------------------------------------
-- Payroll runs, payslips, lines (inputs are snapshotted per line)
-- ---------------------------------------------------------------------------

create table payroll_runs (
  id uuid primary key default gen_random_uuid(),
  run_number text unique,
  run_type text not null default 'regular' check (run_type in ('regular','off_cycle','final_settlement')),
  period_start date not null,
  period_end date not null,
  pay_date date,
  status text not null default 'draft' check (status in ('draft','calculated','pending_approval','approved','paid','cancelled')),
  department_id uuid references departments(id) on delete set null,
  employee_id uuid references employees(id) on delete set null,
  employee_count integer not null default 0,
  totals jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  calculated_at timestamptz,
  submitted_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (run_type <> 'final_settlement' or employee_id is not null)
);
-- One live regular run per period (per department filter).
create unique index payroll_runs_regular_period_idx on payroll_runs (period_start, coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where run_type = 'regular' and status <> 'cancelled';

create table payslips (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references payroll_runs(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  currency char(3) not null,
  basic_salary numeric(14,3) not null default 0,
  total_earnings numeric(14,3) not null default 0,
  total_deductions numeric(14,3) not null default 0,
  gross_pay numeric(14,3) not null default 0,
  taxable_pay numeric(14,3) not null default 0,
  net_pay numeric(14,3) not null default 0,
  working_days numeric(6,2) not null default 0,
  paid_days numeric(6,2) not null default 0,
  absent_days numeric(6,2) not null default 0,
  unpaid_leave_days numeric(6,2) not null default 0,
  late_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  status text not null default 'draft' check (status in ('draft','final','paid','void')),
  warnings text[] not null default '{}',
  published_at timestamptz,
  paid_at timestamptz,
  expense_id uuid references expenses(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, employee_id)
);
create index payslips_employee_idx on payslips (employee_id, created_at desc);

create table payslip_lines (
  id uuid primary key default gen_random_uuid(),
  payslip_id uuid not null references payslips(id) on delete cascade,
  kind text not null check (kind in ('earning','deduction')),
  category text not null,
  code text not null,
  label text not null,
  quantity numeric(10,2),
  rate numeric(14,4),
  amount numeric(14,3) not null check (amount >= 0),
  taxable boolean not null default true,
  source_type text,
  source_id uuid,
  sort_order integer not null default 0
);
create index payslip_lines_payslip_idx on payslip_lines (payslip_id);
create index payslip_lines_source_idx on payslip_lines (source_type, source_id);

alter table employee_separations
  add constraint employee_separations_final_payslip_fk foreign key (final_settlement_payslip_id) references payslips(id) on delete set null;
alter table overtime_requests
  add constraint overtime_requests_payslip_fk foreign key (payslip_id) references payslips(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Bonuses
-- ---------------------------------------------------------------------------

create table employee_bonuses (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  bonus_type text not null check (bonus_type in ('one_time','performance','sales','annual','custom')),
  title text not null,
  amount numeric(14,3) not null check (amount > 0),
  currency char(3) not null references currencies(code),
  reason text not null,
  pay_period date not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid','cancelled')),
  requested_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_comment text,
  payslip_id uuid references payslips(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employee_bonuses_emp_idx on employee_bonuses (employee_id, pay_period);

-- ---------------------------------------------------------------------------
-- Loans / salary advances with installments
-- ---------------------------------------------------------------------------

create table employee_loans (
  id uuid primary key default gen_random_uuid(),
  loan_number text unique,
  employee_id uuid not null references employees(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  loan_type text not null check (loan_type in ('advance','loan')),
  amount numeric(14,3) not null check (amount > 0),
  currency char(3) not null references currencies(code),
  installments integer not null check (installments between 1 and 120),
  installment_amount numeric(14,3) not null check (installment_amount > 0),
  start_period date not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','active','settled','cancelled')),
  requested_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_comment text,
  disbursed_at timestamptz,
  disbursement_reference text,
  settled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employee_loans_emp_idx on employee_loans (employee_id, status);

create table loan_installments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references employee_loans(id) on delete cascade,
  seq integer not null check (seq > 0),
  due_period date not null,
  amount numeric(14,3) not null check (amount > 0),
  status text not null default 'scheduled' check (status in ('scheduled','deducted','paid_manually','waived','skipped')),
  payslip_id uuid references payslips(id) on delete set null,
  settled_at timestamptz,
  note text,
  unique (loan_id, seq)
);
create index loan_installments_due_idx on loan_installments (due_period) where status = 'scheduled';

-- ---------------------------------------------------------------------------
-- Employee expenses: the Finance expense row, extended (§19)
-- ---------------------------------------------------------------------------

alter table expenses
  add column reimbursable boolean not null default false,
  add column reimbursement_status text not null default 'not_applicable' check (reimbursement_status in ('not_applicable','pending','reimbursed')),
  add column reimbursement_method text check (reimbursement_method is null or reimbursement_method in ('payroll','direct')),
  add column reimbursed_at timestamptz,
  add column reimbursement_reference text,
  add column payslip_id uuid references payslips(id) on delete set null,
  add column expense_kind text,
  add column source_type text,
  add column source_id uuid;
create index expenses_source_idx on expenses (source_type, source_id);
create index expenses_employee_idx on expenses (employee_user_id) where employee_user_id is not null;

insert into expense_categories (name, cost_type, is_active)
select v.name, v.cost_type::cost_type, true
from (values ('الرواتب والأجور', 'employee'), ('انتقالات ومواصلات', 'employee'), ('سفر ومهام عمل', 'employee'), ('اجتماعات العملاء والضيافة', 'employee'), ('وجبات', 'employee'), ('مشتريات', 'other')) as v(name, cost_type)
where not exists (select 1 from expense_categories c where c.name = v.name);

-- ---------------------------------------------------------------------------
-- Other employee requests (§26)
-- ---------------------------------------------------------------------------

create table hr_request_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+$'),
  name text not null,
  description text,
  approval_steps text[] not null default array['manager'],
  requires_attachment boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into hr_request_types (key, name, approval_steps, sort_order) values
  ('salary_certificate', 'شهادة راتب', array['role:hr'], 10),
  ('employment_letter', 'خطاب تعريف بالعمل', array['role:hr'], 20),
  ('experience_letter', 'شهادة خبرة', array['role:hr'], 30),
  ('data_update', 'تحديث بيانات شخصية', array['role:hr'], 40),
  ('equipment', 'طلب معدات / أصول', array['manager','role:admin'], 50),
  ('schedule_change', 'تغيير جدول العمل', array['manager','role:hr'], 60),
  ('remote_work', 'عمل عن بُعد', array['manager'], 70),
  ('training', 'طلب تدريب', array['manager','role:hr'], 80),
  ('other', 'طلب آخر', array['manager'], 90)
on conflict (key) do nothing;

create table hr_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text unique,
  employee_id uuid not null references employees(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  type_id uuid not null references hr_request_types(id) on delete restrict,
  subject text not null,
  details text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','in_progress','completed','cancelled')),
  due_date date,
  response text,
  handled_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hr_requests_emp_idx on hr_requests (employee_id, status);

-- ---------------------------------------------------------------------------
-- Settings defaults (payroll policy incl. overtime rules; approval rules)
-- ---------------------------------------------------------------------------

insert into bos_settings (key, value) values ('payroll_policy', '{
  "working_days_basis": "schedule",
  "absence_deduction": true,
  "unpaid_leave_deduction": true,
  "late_deduction": "none",
  "late_grace_minutes_per_month": 60,
  "include_commissions": true,
  "include_reimbursements": true,
  "overtime": {
    "source": "approved_requests",
    "standard_monthly_hours": 176,
    "workday_multiplier": 1.5,
    "day_off_multiplier": 2,
    "holiday_multiplier": 2
  },
  "tax": { "enabled": false, "exemption_monthly": 0, "brackets": [ { "up_to": null, "rate": 0 } ] },
  "insurance": { "enabled": false, "employee_percent": 11, "basis": "basic", "cap_monthly": null },
  "salary_expense_category": "الرواتب والأجور"
}'::jsonb)
on conflict (key) do nothing;

update bos_settings set value = value
  || case when value ? 'payroll' then '{}'::jsonb else '{"payroll": {"steps": ["role:finance"]}}'::jsonb end
  || case when value ? 'loan' then '{}'::jsonb else '{"loan": {"steps": ["manager", "role:hr", "role:finance"]}}'::jsonb end
  || case when value ? 'advance' then '{}'::jsonb else '{"advance": {"steps": ["manager", "role:finance"]}}'::jsonb end
  || case when value ? 'bonus' then '{}'::jsonb else '{"bonus": {"steps": ["role:finance"]}}'::jsonb end
  || case when value ? 'employee_expense' then '{}'::jsonb else '{"employee_expense": {"steps": ["manager", "role:finance"]}}'::jsonb end
  || case when value ? 'salary_adjustment' then '{}'::jsonb else '{"salary_adjustment": {"steps": ["role:finance"]}}'::jsonb end
  || case when value ? 'job_offer' then '{}'::jsonb else '{"job_offer": {"required": false, "steps": ["role:hr"]}}'::jsonb end
where key = 'approval_policies';

create trigger payroll_runs_touch before update on payroll_runs for each row execute function bos_touch_updated_at();
create trigger payslips_touch before update on payslips for each row execute function bos_touch_updated_at();
create trigger employee_bonuses_touch before update on employee_bonuses for each row execute function bos_touch_updated_at();
create trigger employee_loans_touch before update on employee_loans for each row execute function bos_touch_updated_at();
create trigger hr_requests_touch before update on hr_requests for each row execute function bos_touch_updated_at();

alter table payroll_runs enable row level security;
alter table payslips enable row level security;
alter table payslip_lines enable row level security;
alter table employee_bonuses enable row level security;
alter table employee_loans enable row level security;
alter table loan_installments enable row level security;
alter table hr_request_types enable row level security;
alter table hr_requests enable row level security;

grant all on all tables in schema public to service_role;
