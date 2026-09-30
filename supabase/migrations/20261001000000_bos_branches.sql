-- Master upgrade Phase 1 (docs/bos/30 §3.2, doc 31): branches inside one
-- company installation. Every existing record joins the head office, so
-- nothing changes for current data; new records infer their branch from
-- their parent (client → deal → project → invoice…) or their owner.

create table branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{1,20}$'),
  name text not null,
  name_en text,
  is_head_office boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive')),
  address text,
  country text,
  region text,
  city text,
  postal_code text,
  timezone text not null default 'Africa/Cairo',
  currency char(3) references currencies(code),
  phone text,
  email text,
  manager_employee_id uuid references employees(id) on delete set null,
  work_schedule_id uuid references work_schedules(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index branches_one_head_office on branches (is_head_office) where is_head_office;
create trigger branches_touch before update on branches for each row execute function bos_touch_updated_at();

insert into branches (code, name, name_en, is_head_office, timezone, currency, address)
select 'HQ', 'المقر الرئيسي', 'Head Office', true,
       coalesce((select value->>'timezone' from bos_settings where key = 'company'), 'Africa/Cairo'),
       null,
       nullif((select value->>'address' from bos_settings where key = 'company'), '')
where not exists (select 1 from branches);

create or replace function public.bos_head_office()
returns uuid
language sql
stable
as $$ select id from branches where is_head_office limit 1; $$;

-- Explicit extra branch access for users (their own branch is implicit).
create table user_branch_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);

-- ---------------------------------------------------------------------------
-- branch_id on records (nullable for safety; filled by backfill + triggers)
-- ---------------------------------------------------------------------------
alter table employees add column branch_id uuid references branches(id) on delete set null;
alter table departments add column branch_id uuid references branches(id) on delete set null;
alter table leads add column branch_id uuid references branches(id) on delete set null;
alter table clients add column branch_id uuid references branches(id) on delete set null;
alter table deals add column branch_id uuid references branches(id) on delete set null;
alter table projects add column branch_id uuid references branches(id) on delete set null;
alter table invoices add column branch_id uuid references branches(id) on delete set null;
alter table payments add column branch_id uuid references branches(id) on delete set null;
alter table expenses add column branch_id uuid references branches(id) on delete set null;
alter table tickets add column branch_id uuid references branches(id) on delete set null;
alter table devices add column branch_id uuid references branches(id) on delete set null;
alter table career_jobs add column branch_id uuid references branches(id) on delete set null;
alter table payroll_runs add column branch_id uuid references branches(id) on delete set null;
alter table holidays add column branch_id uuid references branches(id) on delete cascade;

do $$
declare t text;
begin
  foreach t in array array['employees','leads','clients','deals','projects','invoices','payments','expenses','tickets','devices','career_jobs']
  loop
    execute format('update %I set branch_id = bos_head_office() where branch_id is null', t);
    execute format('create index %I on %I (branch_id)', t || '_branch_idx', t);
  end loop;
end $$;

-- Branch of a staff user (via employees).
create or replace function public.bos_user_branch(p_user uuid)
returns uuid
language sql
stable
as $$ select coalesce((select branch_id from employees where user_id = p_user), bos_head_office()); $$;

create or replace function public.bos_infer_branch()
returns trigger
language plpgsql
as $$
declare
  v uuid;
begin
  if new.branch_id is not null then return new; end if;
  case tg_table_name
    when 'employees' then
      v := null;
    when 'leads' then
      v := coalesce((select branch_id from clients where id = new.client_id), case when new.assigned_to is not null then bos_user_branch(new.assigned_to) end, case when new.created_by is not null then bos_user_branch(new.created_by) end);
    when 'clients' then
      v := coalesce(case when new.account_manager_id is not null then bos_user_branch(new.account_manager_id) end, case when new.created_by is not null then bos_user_branch(new.created_by) end);
    when 'deals' then
      v := coalesce((select branch_id from clients where id = new.client_id), (select branch_id from leads where id = new.lead_id), case when new.assigned_to is not null then bos_user_branch(new.assigned_to) end);
    when 'projects' then
      v := coalesce((select branch_id from deals where id = new.deal_id), (select branch_id from clients where id = new.client_id));
    when 'invoices' then
      v := coalesce((select branch_id from projects where id = new.project_id), (select branch_id from deals where id = new.deal_id), (select branch_id from clients where id = new.client_id));
    when 'payments' then
      v := coalesce((select branch_id from projects where id = new.project_id), (select branch_id from deals where id = new.deal_id), (select branch_id from clients where id = new.client_id));
    when 'expenses' then
      v := coalesce((select branch_id from projects where id = new.project_id), case when new.employee_user_id is not null then bos_user_branch(new.employee_user_id) end, case when new.created_by is not null then bos_user_branch(new.created_by) end);
    when 'tickets' then
      v := coalesce((select branch_id from projects where id = new.project_id), (select branch_id from clients where id = new.client_id));
    when 'devices' then
      v := (select branch_id from employees where id = new.assigned_employee_id);
    when 'career_jobs' then
      v := coalesce((select branch_id from departments where id = new.department_id), case when new.created_by is not null then bos_user_branch(new.created_by) end);
    else
      v := null;
  end case;
  new.branch_id := coalesce(v, bos_head_office());
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['employees','leads','clients','deals','projects','invoices','payments','expenses','tickets','devices','career_jobs']
  loop
    execute format('create trigger %I before insert on %I for each row execute function bos_infer_branch()', t || '_infer_branch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Schedules: branch level between department and company
-- ---------------------------------------------------------------------------
alter table schedule_assignments drop constraint schedule_assignments_check1;
alter table schedule_assignments add column branch_id uuid references branches(id) on delete cascade;
alter table schedule_assignments drop constraint if exists schedule_assignments_scope_check;
alter table schedule_assignments add constraint schedule_assignments_scope_check check (scope in ('company','branch','department','team','employee'));
alter table schedule_assignments add constraint schedule_assignments_target_check check (
  (scope = 'company' and department_id is null and team_id is null and employee_id is null and branch_id is null) or
  (scope = 'branch' and branch_id is not null and department_id is null and team_id is null and employee_id is null) or
  (scope = 'department' and department_id is not null and team_id is null and employee_id is null and branch_id is null) or
  (scope = 'team' and team_id is not null and department_id is null and employee_id is null and branch_id is null) or
  (scope = 'employee' and employee_id is not null and department_id is null and team_id is null and branch_id is null)
);

create or replace function public.bos_resolve_schedule_id(p_employee uuid, p_date date)
returns uuid
language sql
stable
as $$
  select coalesce(
    (select schedule_id from shift_assignments where employee_id = p_employee and work_date = p_date),
    (select sa.schedule_id from schedule_assignments sa
      where sa.scope = 'employee' and sa.employee_id = p_employee
        and p_date >= sa.effective_from and (sa.effective_to is null or p_date <= sa.effective_to)
      order by sa.effective_from desc, sa.created_at desc limit 1),
    (select work_schedule_id from employees where id = p_employee),
    (select sa.schedule_id from schedule_assignments sa join employees e on e.id = p_employee
      where sa.scope = 'team' and sa.team_id = e.team_id
        and p_date >= sa.effective_from and (sa.effective_to is null or p_date <= sa.effective_to)
      order by sa.effective_from desc, sa.created_at desc limit 1),
    (select sa.schedule_id from schedule_assignments sa join employees e on e.id = p_employee
      where sa.scope = 'department' and sa.department_id = e.department_id
        and p_date >= sa.effective_from and (sa.effective_to is null or p_date <= sa.effective_to)
      order by sa.effective_from desc, sa.created_at desc limit 1),
    (select sa.schedule_id from schedule_assignments sa join employees e on e.id = p_employee
      where sa.scope = 'branch' and sa.branch_id = e.branch_id
        and p_date >= sa.effective_from and (sa.effective_to is null or p_date <= sa.effective_to)
      order by sa.effective_from desc, sa.created_at desc limit 1),
    (select b.work_schedule_id from employees e join branches b on b.id = e.branch_id where e.id = p_employee),
    (select sa.schedule_id from schedule_assignments sa
      where sa.scope = 'company'
        and p_date >= sa.effective_from and (sa.effective_to is null or p_date <= sa.effective_to)
      order by sa.effective_from desc, sa.created_at desc limit 1),
    (select id from work_schedules where is_default order by created_at limit 1)
  );
$$;

-- Holidays may be limited to one branch.
create or replace function public.bos_day_off_reason(p_employee uuid, p_date date)
returns text
language sql
stable
as $$
  select case
    when exists (select 1 from holidays h, employees e where e.id = p_employee and h.date = p_date
                   and (h.country is null or h.country = e.country)
                   and (h.branch_id is null or h.branch_id = e.branch_id)) then 'holiday'
    when exists (select 1 from employee_days_off o, employees e where e.id = p_employee and o.date = p_date and (
            (o.scope = 'employee' and o.employee_id = e.id) or
            (o.scope = 'team' and o.team_id = e.team_id) or
            (o.scope = 'department' and o.department_id = e.department_id))) then 'custom'
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions: branches module
-- ---------------------------------------------------------------------------
insert into permissions (key, module, action, description)
select 'branches.' || a::text, 'branches', a, 'Branches — ' || replace(a::text, '_', ' ')
from unnest(enum_range(null::permission_action)) as a
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from roles r join permissions p on p.module = 'branches'
where (r.key in ('super_admin','admin'))
   or (r.key in ('executive','finance','hr') and p.action::text in ('read','export'))
on conflict (role_id, permission_id) do nothing;

alter table branches enable row level security;
alter table user_branch_access enable row level security;
grant all on all tables in schema public to service_role;
revoke execute on function public.bos_head_office(), public.bos_user_branch(uuid) from public, anon, authenticated;
