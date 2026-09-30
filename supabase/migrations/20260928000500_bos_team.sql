-- Taysonsta BOS — Phase 5: team, attendance, leave, overtime, KPIs.
-- Attendance maths runs in Postgres with IANA time zones (`at time zone`)
-- so schedule/grace/overtime rules are evaluated in the employee's work
-- timezone (§103). Hours and rules are configuration, never hard-coded (§31).
-- See docs/bos/13-attendance.md and 12-team-hr.md.

create type attendance_status as enum ('present','late','absent','half_day','leave','holiday','overtime','remote','on_break');
create type correction_status as enum ('pending','approved','rejected');
create type leave_status as enum ('pending','approved','rejected','cancelled');
create type kpi_period as enum ('weekly','monthly','quarterly','yearly');

create table holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null,
  country text,
  created_at timestamptz not null default now()
);
create unique index holidays_date_country_idx on holidays (date, coalesce(country, ''));

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  work_date date not null,
  schedule_id uuid references work_schedules(id) on delete set null,
  timezone text not null,
  status attendance_status not null default 'present',
  is_remote boolean not null default false,
  first_clock_in timestamptz,
  last_clock_out timestamptz,
  worked_minutes integer not null default 0,
  break_minutes integer not null default 0,
  expected_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  late_minutes integer not null default 0,
  requires_review boolean not null default false,
  review_reason text,
  last_system_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);
create index attendance_records_date_idx on attendance_records (work_date);
create index attendance_records_review_idx on attendance_records (requires_review) where requires_review;

create table attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references attendance_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  clock_in_timezone text,
  source text not null default 'web' check (source in ('web','mobile','correction','auto','hr')),
  auto_closed boolean not null default false,
  closed_reason text,
  created_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at >= clock_in_at)
);
create unique index attendance_sessions_open_idx on attendance_sessions (user_id) where clock_out_at is null;
create index attendance_sessions_record_idx on attendance_sessions (record_id);
create index attendance_sessions_user_idx on attendance_sessions (user_id, clock_in_at desc);

create table attendance_breaks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references attendance_sessions(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at)
);
create unique index attendance_breaks_open_idx on attendance_breaks (session_id) where ended_at is null;

create table attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references attendance_records(id) on delete cascade,
  session_id uuid references attendance_sessions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete restrict,
  work_date date not null,
  original jsonb not null default '{}'::jsonb,
  requested_clock_in timestamptz,
  requested_clock_out timestamptz,
  reason text not null check (length(trim(reason)) > 0),
  status correction_status not null default 'pending',
  approval_group_id uuid,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  submitted_at timestamptz not null default now(),
  check (requested_clock_in is not null or requested_clock_out is not null),
  check (requested_clock_out is null or requested_clock_in is null or requested_clock_out > requested_clock_in)
);
create index attendance_corrections_user_idx on attendance_corrections (user_id, status);

create table overtime_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  work_date date not null,
  minutes integer not null check (minutes > 0),
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approval_group_id uuid,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  compensation_status text not null default 'pending' check (compensation_status in ('pending','paid','time_off','not_applicable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index overtime_requests_user_idx on overtime_requests (user_id, work_date);

create table leave_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z_]+$'),
  name text not null,
  is_paid boolean not null default true,
  annual_allowance_days numeric(5,1),
  requires_approval boolean not null default true,
  requires_reason boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

insert into leave_types (key, name, is_paid, annual_allowance_days, requires_reason, sort_order) values
  ('annual', 'Annual leave', true, 21, false, 1),
  ('sick', 'Sick leave', true, 10, true, 2),
  ('personal', 'Personal leave', true, 3, true, 3),
  ('unpaid', 'Unpaid leave', false, null, true, 4);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  leave_type_id uuid not null references leave_types(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  half_day boolean not null default false,
  duration_days numeric(5,1) not null check (duration_days > 0),
  reason text,
  status leave_status not null default 'pending',
  approval_group_id uuid,
  approver_id uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (not half_day or start_date = end_date)
);
create index leave_requests_user_idx on leave_requests (user_id, start_date);
create index leave_requests_status_idx on leave_requests (status);

create or replace function public.bos_leave_no_overlap()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('pending','approved') and exists (
    select 1 from leave_requests l
    where l.user_id = new.user_id and l.id <> new.id and l.status in ('pending','approved')
      and daterange(l.start_date, l.end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'This leave overlaps another pending or approved leave request' using errcode = '23P01';
  end if;
  return new;
end;
$$;

create trigger leave_requests_no_overlap before insert or update of start_date, end_date, status, user_id
on leave_requests for each row execute function bos_leave_no_overlap();

-- ---------------------------------------------------------------------------
-- KPI engine
-- ---------------------------------------------------------------------------

create table kpis (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  role_id uuid references roles(id) on delete set null,
  department_id uuid references departments(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  data_source text not null,
  calculation text not null default 'count' check (calculation in ('count','sum','avg','ratio','manual')),
  unit text not null default 'count' check (unit in ('count','currency','percent','hours','score')),
  direction text not null default 'higher_better' check (direction in ('higher_better','lower_better')),
  target numeric(14,3) not null default 0,
  period kpi_period not null default 'monthly',
  weight numeric(5,2) check (weight is null or weight between 0 and 100),
  weight_enabled boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table kpi_assignments (
  kpi_id uuid not null references kpis(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_override numeric(14,3),
  primary key (kpi_id, user_id)
);

create table kpi_values (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references kpis(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  actual numeric(14,3),
  target numeric(14,3),
  note text,
  computed_at timestamptz not null default now(),
  unique (kpi_id, user_id, period_start)
);

create table performance_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  reviewer_id uuid references auth.users(id) on delete set null,
  period_start date not null,
  period_end date not null,
  summary text,
  strengths text,
  improvements text,
  goals text,
  status text not null default 'draft' check (status in ('draft','submitted','acknowledged')),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

-- Seed KPI definitions from the spec examples (§38). Targets are editable.
insert into kpis (name, category, role_id, data_source, calculation, unit, target, period)
select k.name, k.category, r.id, k.src, k.calc, k.unit, k.target, 'monthly'
from roles r
join (values
  ('business_development', 'Qualified leads', 'Sales', 'leads.qualified_count', 'count', 'count', 20),
  ('business_development', 'Outreach', 'Sales', 'activities.outreach_count', 'count', 'count', 200),
  ('business_development', 'Meetings', 'Sales', 'meetings.count', 'count', 'count', 10),
  ('business_development', 'Proposals', 'Sales', 'proposals.sent_count', 'count', 'count', 4),
  ('business_development', 'Pipeline', 'Sales', 'deals.pipeline_value', 'sum', 'currency', 80000),
  ('business_development', 'Won revenue', 'Sales', 'deals.won_value', 'sum', 'currency', 20000),
  ('business_development', 'Conversion rate', 'Sales', 'deals.conversion_rate', 'ratio', 'percent', 20),
  ('business_development', 'Collection', 'Sales', 'payments.collected_value', 'sum', 'currency', 15000),
  ('business_development', 'Commission', 'Sales', 'commissions.amount', 'sum', 'currency', 2000),
  ('project_manager', 'On-time projects', 'Delivery', 'projects.on_time_ratio', 'ratio', 'percent', 90),
  ('project_manager', 'Milestone completion', 'Delivery', 'milestones.completion_ratio', 'ratio', 'percent', 90),
  ('project_manager', 'Task completion', 'Delivery', 'tasks.completion_ratio', 'ratio', 'percent', 90),
  ('project_manager', 'Budget variance', 'Delivery', 'projects.budget_variance', 'ratio', 'percent', 5),
  ('project_manager', 'Client satisfaction', 'Delivery', 'projects.satisfaction_avg', 'avg', 'score', 8),
  ('project_manager', 'Open issues', 'Delivery', 'issues.open_count', 'count', 'count', 3)
) as k(role_key, name, category, src, calc, unit, target) on k.role_key = r.key;

update kpis set direction = 'lower_better' where data_source in ('projects.budget_variance','issues.open_count');

-- Metric registry (docs/bos/12-team-hr.md). Returns null for unknown keys.
create or replace function public.bos_kpi_actual(p_source text, p_user uuid, p_start date, p_end date)
returns numeric
language plpgsql
stable
as $$
declare
  v_from timestamptz := p_start::timestamptz;
  v_to timestamptz := (p_end + 1)::timestamptz;
  v_num numeric;
  v_den numeric;
begin
  case p_source
    when 'leads.qualified_count' then
      return (select count(distinct sh.entity_id) from status_history sh join leads l on l.id = sh.entity_id
              where sh.entity_type = 'lead' and sh.to_status = 'qualified' and l.assigned_to = p_user
                and sh.changed_at >= v_from and sh.changed_at < v_to);
    when 'leads.created_count' then
      return (select count(*) from leads where assigned_to = p_user and created_at >= v_from and created_at < v_to);
    when 'activities.outreach_count' then
      return (select count(*) from activities where coalesce(assigned_to, created_by) = p_user
              and type in ('call','email','whatsapp','linkedin') and coalesce(direction, 'outbound') = 'outbound'
              and created_at >= v_from and created_at < v_to);
    when 'meetings.count' then
      return (select count(*) from meetings where organizer_id = p_user and status = 'completed'
              and start_at >= v_from and start_at < v_to);
    when 'proposals.sent_count' then
      return (select count(*) from proposals where owner_id = p_user and sent_at >= v_from and sent_at < v_to);
    when 'deals.pipeline_value' then
      return (select coalesce(sum(d.value), 0) from deals d join pipeline_stages s on s.id = d.stage_id
              where d.assigned_to = p_user and s.category = 'open' and d.archived_at is null);
    when 'deals.won_value' then
      return (select coalesce(sum(value), 0) from deals where assigned_to = p_user and won_at >= v_from and won_at < v_to);
    when 'deals.conversion_rate' then
      select count(*) filter (where won_at is not null), count(*) into v_num, v_den
        from deals where assigned_to = p_user and created_at >= v_from and created_at < v_to;
      return case when v_den > 0 then round(100 * v_num / v_den, 2) else 0 end;
    when 'payments.collected_value' then
      return (select coalesce(sum(p.deal_amount * (p.amount - p.refunded_amount) / p.amount), 0)
              from payments p join deals d on d.id = p.deal_id
              where d.assigned_to = p_user and p.status in ('completed','refunded')
                and p.payment_date >= p_start and p.payment_date <= p_end);
    when 'commissions.amount' then
      return (select coalesce(sum(eligible_amount), 0) from commissions
              where user_id = p_user and status in ('eligible','approved','paid')
                and coalesce(eligible_at, created_at) >= v_from and coalesce(eligible_at, created_at) < v_to);
    when 'projects.on_time_ratio' then
      select count(*) filter (where completed_at::date <= deadline), count(*) into v_num, v_den
        from projects where pm_id = p_user and status = 'completed' and completed_at >= v_from and completed_at < v_to;
      return case when v_den > 0 then round(100 * v_num / v_den, 2) else null end;
    when 'milestones.completion_ratio' then
      select count(*) filter (where m.status = 'completed' and m.completed_at::date <= m.due_date), count(*) into v_num, v_den
        from milestones m join projects p on p.id = m.project_id
       where p.pm_id = p_user and m.due_date between p_start and p_end;
      return case when v_den > 0 then round(100 * v_num / v_den, 2) else null end;
    when 'tasks.completion_ratio' then
      select count(*) filter (where status = 'completed'), count(*) into v_num, v_den
        from tasks where assigned_to = p_user and due_date between p_start and p_end and status <> 'cancelled';
      return case when v_den > 0 then round(100 * v_num / v_den, 2) else null end;
    when 'tasks.completed_count' then
      return (select count(*) from tasks where assigned_to = p_user and completed_at >= v_from and completed_at < v_to);
    when 'projects.budget_variance' then
      return (select round(avg(case when p.budget > 0 then 100 * (coalesce(c.cost, 0) - p.budget) / p.budget end), 2)
              from projects p
              left join lateral (
                select coalesce(sum(te.cost_amount), 0) + coalesce((select sum(e.amount) from expenses e where e.project_id = p.id and e.approval_status = 'approved'), 0) as cost
                from time_entries te where te.project_id = p.id
              ) c on true
              where p.pm_id = p_user and p.status not in ('cancelled'));
    when 'projects.satisfaction_avg' then
      return (select round(avg(satisfaction_score), 2) from projects where pm_id = p_user
              and satisfaction_score is not null and completed_at >= v_from and completed_at < v_to);
    when 'issues.open_count' then
      return (select count(*) from issues i join projects p on p.id = i.project_id
              where p.pm_id = p_user and i.status in ('open','in_progress'));
    when 'attendance.on_time_ratio' then
      select count(*) filter (where status in ('present','overtime','remote')), count(*) filter (where status in ('present','late','overtime','remote','half_day'))
        into v_num, v_den from attendance_records where user_id = p_user and work_date between p_start and p_end;
      return case when v_den > 0 then round(100 * v_num / v_den, 2) else null end;
    when 'time.logged_hours' then
      return (select round(coalesce(sum(duration_minutes), 0) / 60.0, 2) from time_entries
              where user_id = p_user and started_at >= v_from and started_at < v_to);
    else
      return null;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- Attendance functions
-- ---------------------------------------------------------------------------

create or replace function public.bos_employee_schedule(p_user uuid)
returns work_schedules
language sql
stable
as $$
  select ws.* from work_schedules ws
  where ws.id = coalesce((select work_schedule_id from employees where user_id = p_user),
                         (select id from work_schedules where is_default limit 1));
$$;

create or replace function public.bos_recalc_attendance_day(p_record uuid)
returns void
language plpgsql
as $$
declare
  v_rec attendance_records%rowtype;
  v_sched work_schedules%rowtype;
  v_policy jsonb := coalesce((select value from bos_settings where key = 'attendance_policy'), '{}'::jsonb);
  v_country text;
  v_is_work_day boolean;
  v_is_holiday boolean;
  v_leave record;
  v_expected integer := 0;
  v_worked integer := 0;
  v_breaks integer := 0;
  v_late integer := 0;
  v_overtime integer := 0;
  v_status attendance_status;
  v_open_session boolean;
  v_open_break boolean;
  v_first timestamptz;
  v_last timestamptz;
  v_local_in time;
begin
  select * into v_rec from attendance_records where id = p_record for update;
  if v_rec.id is null then return; end if;

  select * into v_sched from work_schedules where id = v_rec.schedule_id;
  if v_sched.id is null then
    v_sched := bos_employee_schedule(v_rec.user_id);
  end if;
  select country into v_country from employees where user_id = v_rec.user_id;

  v_is_holiday := exists (select 1 from holidays where date = v_rec.work_date and (country is null or country = v_country));
  v_is_work_day := extract(dow from v_rec.work_date)::smallint = any(v_sched.work_days) and not v_is_holiday;

  select lr.*, lt.key as type_key into v_leave from leave_requests lr join leave_types lt on lt.id = lr.leave_type_id
   where lr.user_id = v_rec.user_id and lr.status = 'approved' and v_rec.work_date between lr.start_date and lr.end_date
   limit 1;

  if v_is_work_day then
    v_expected := extract(epoch from (v_sched.end_time - v_sched.start_time))::integer / 60;
    if not coalesce((v_policy->>'expected_includes_break')::boolean, true) then
      v_expected := v_expected - v_sched.break_minutes;
    end if;
    if v_leave.id is not null then
      v_expected := case when v_leave.half_day then v_expected / 2 else 0 end;
    end if;
  end if;

  select coalesce(sum(extract(epoch from (clock_out_at - clock_in_at)) / 60), 0)::integer,
         min(clock_in_at), max(clock_out_at),
         bool_or(clock_out_at is null)
    into v_worked, v_first, v_last, v_open_session
    from attendance_sessions where record_id = p_record;

  select coalesce(sum(extract(epoch from (b.ended_at - b.started_at)) / 60), 0)::integer,
         bool_or(b.ended_at is null)
    into v_breaks, v_open_break
    from attendance_breaks b join attendance_sessions s on s.id = b.session_id
   where s.record_id = p_record;

  v_worked := greatest(0, v_worked - v_breaks);
  if coalesce((v_policy->>'deduct_scheduled_break')::boolean, false) and v_breaks = 0 and v_worked > v_sched.break_minutes then
    v_worked := v_worked - v_sched.break_minutes;
    v_breaks := v_sched.break_minutes;
  end if;

  if v_first is not null and v_is_work_day and v_leave.id is null then
    v_local_in := (v_first at time zone v_rec.timezone)::time;
    if v_local_in > v_sched.start_time + make_interval(mins => v_sched.grace_minutes) then
      v_late := (extract(epoch from (v_local_in - v_sched.start_time)) / 60)::integer;
    end if;
  end if;

  if v_first is not null and not coalesce(v_open_session, false) then
    if v_expected > 0 then
      v_overtime := greatest(0, v_worked - v_expected - v_sched.overtime_after_minutes);
    else
      v_overtime := v_worked;
    end if;
  end if;

  v_status := case
    when v_first is null and v_leave.id is not null then 'leave'
    when v_first is null and v_is_holiday then 'holiday'
    when v_first is null and v_is_work_day then 'absent'
    when v_first is null then 'holiday'
    when coalesce(v_open_break, false) then 'on_break'
    when v_late > 0 then 'late'
    when not coalesce(v_open_session, false) and v_expected > 0 and v_worked < v_sched.half_day_minutes then 'half_day'
    when v_overtime > 0 then 'overtime'
    else 'present'
  end;

  update attendance_records set
    status = case when v_rec.status = 'remote' and v_status = 'present' then 'remote' else v_status end,
    first_clock_in = v_first,
    last_clock_out = case when coalesce(v_open_session, false) then null else v_last end,
    worked_minutes = v_worked,
    break_minutes = v_breaks,
    expected_minutes = v_expected,
    overtime_minutes = v_overtime,
    late_minutes = v_late,
    schedule_id = v_sched.id,
    updated_at = now()
  where id = p_record;
end;
$$;

create or replace function public.bos_clock_in(p_user uuid, p_source text default 'web', p_client_tz text default null)
returns uuid
language plpgsql
as $$
declare
  v_emp employees%rowtype;
  v_sched work_schedules%rowtype;
  v_tz text;
  v_date date;
  v_record uuid;
  v_session uuid;
begin
  select * into v_emp from employees where user_id = p_user;
  if v_emp.id is null then
    raise exception 'No employee profile is linked to this account' using errcode = 'P0002';
  end if;
  if v_emp.lifecycle_status not in ('active','onboarding','on_leave','offboarding') then
    raise exception 'Your employee status (%) does not allow clocking in', v_emp.lifecycle_status using errcode = '22023';
  end if;
  if exists (select 1 from attendance_sessions where user_id = p_user and clock_out_at is null) then
    raise exception 'You are already clocked in. End your current session first.' using errcode = '23505';
  end if;

  v_sched := bos_employee_schedule(p_user);
  v_tz := coalesce(v_sched.timezone, v_emp.timezone, 'Africa/Cairo');
  v_date := (now() at time zone v_tz)::date;

  insert into attendance_records (user_id, work_date, schedule_id, timezone, is_remote)
  values (p_user, v_date, v_sched.id, v_tz, v_emp.is_remote)
  on conflict (user_id, work_date) do update set updated_at = now()
  returning id into v_record;

  insert into attendance_sessions (record_id, user_id, clock_in_at, clock_in_timezone, source)
  values (v_record, p_user, now(), p_client_tz, coalesce(p_source, 'web'))
  returning id into v_session;

  perform bos_recalc_attendance_day(v_record);
  update employees set last_activity_at = now() where user_id = p_user;
  update attendance_records set last_system_activity_at = now() where id = v_record;

  perform bos_emit('attendance.clock_in', 'employee', v_emp.id, p_user, v_emp.full_name || ' started work',
    jsonb_build_object('record_id', v_record, 'session_id', v_session, 'work_date', v_date, 'timezone', v_tz,
                       'employee_user_id', p_user, 'status', (select status from attendance_records where id = v_record)),
    '[]'::jsonb, 'user', 'internal', 'attendance.clock_in:' || v_session);

  return v_session;
end;
$$;

create or replace function public.bos_clock_out(p_user uuid, p_source text default 'web')
returns uuid
language plpgsql
as $$
declare
  v_session attendance_sessions%rowtype;
  v_emp employees%rowtype;
  v_rec attendance_records%rowtype;
begin
  select * into v_session from attendance_sessions where user_id = p_user and clock_out_at is null for update;
  if v_session.id is null then
    raise exception 'You are not clocked in.' using errcode = 'P0002';
  end if;

  update attendance_breaks set ended_at = now() where session_id = v_session.id and ended_at is null;
  update attendance_sessions set clock_out_at = now(), closed_reason = 'clock_out' where id = v_session.id;

  -- Running timers stop when the work session ends.
  update time_entries set ended_at = greatest(now(), started_at + interval '1 minute'),
         description = coalesce(description, '') || case when description is null then '' else ' ' end || '(stopped at clock-out)'
   where user_id = p_user and ended_at is null;

  perform bos_recalc_attendance_day(v_session.record_id);
  update employees set last_activity_at = now() where user_id = p_user;
  update attendance_records set last_system_activity_at = now() where id = v_session.record_id;

  select * into v_emp from employees where user_id = p_user;
  select * into v_rec from attendance_records where id = v_session.record_id;

  perform bos_emit('attendance.clock_out', 'employee', v_emp.id, p_user, v_emp.full_name || ' ended work',
    jsonb_build_object('record_id', v_rec.id, 'session_id', v_session.id, 'work_date', v_rec.work_date,
                       'worked_minutes', v_rec.worked_minutes, 'overtime_minutes', v_rec.overtime_minutes,
                       'employee_user_id', p_user, 'status', v_rec.status),
    '[]'::jsonb, 'user', 'internal', 'attendance.clock_out:' || v_session.id);

  return v_session.id;
end;
$$;

create or replace function public.bos_start_break(p_user uuid)
returns uuid
language plpgsql
as $$
declare
  v_session attendance_sessions%rowtype;
  v_break uuid;
begin
  select * into v_session from attendance_sessions where user_id = p_user and clock_out_at is null;
  if v_session.id is null then
    raise exception 'Start work before taking a break.' using errcode = 'P0002';
  end if;
  insert into attendance_breaks (session_id) values (v_session.id) returning id into v_break;
  perform bos_recalc_attendance_day(v_session.record_id);
  return v_break;
exception when unique_violation then
  raise exception 'You are already on a break.' using errcode = '23505';
end;
$$;

create or replace function public.bos_end_break(p_user uuid)
returns void
language plpgsql
as $$
declare
  v_session attendance_sessions%rowtype;
begin
  select * into v_session from attendance_sessions where user_id = p_user and clock_out_at is null;
  if v_session.id is null then
    raise exception 'You are not clocked in.' using errcode = 'P0002';
  end if;
  update attendance_breaks set ended_at = now() where session_id = v_session.id and ended_at is null;
  if not found then
    raise exception 'You are not on a break.' using errcode = 'P0002';
  end if;
  perform bos_recalc_attendance_day(v_session.record_id);
end;
$$;

-- Forgotten clock-out (§35): applies the configured company policy.
create or replace function public.bos_detect_open_sessions()
returns integer
language plpgsql
as $$
declare
  v_policy jsonb := coalesce((select value from bos_settings where key = 'attendance_policy'), '{}'::jsonb);
  v_fco jsonb := coalesce(v_policy->'forgotten_clock_out', '{}'::jsonb);
  v_after integer := coalesce((v_policy->>'auto_close_after_minutes')::int, 120);
  v_s record;
  v_end_at timestamptz;
  v_n integer := 0;
  v_notify text[];
begin
  for v_s in
    select s.*, r.work_date, r.timezone, ws.end_time, e.id as employee_id, e.full_name
    from attendance_sessions s
    join attendance_records r on r.id = s.record_id
    left join work_schedules ws on ws.id = r.schedule_id
    join employees e on e.user_id = s.user_id
    where s.clock_out_at is null
    for update of s skip locked
  loop
    v_end_at := ((v_s.work_date + coalesce(v_s.end_time, '18:00'::time)) at time zone v_s.timezone);
    if now() < greatest(v_end_at, v_s.clock_in_at) + make_interval(mins => v_after) and now() < v_s.clock_in_at + interval '16 hours' then
      continue;
    end if;

    if coalesce((v_fco->>'auto_close_at_schedule_end')::boolean, true) then
      update attendance_breaks set ended_at = greatest(started_at, least(now(), greatest(v_end_at, v_s.clock_in_at)))
       where session_id = v_s.id and ended_at is null;
      update attendance_sessions
         set clock_out_at = greatest(v_end_at, v_s.clock_in_at), auto_closed = true, closed_reason = 'auto_closed_forgotten_clock_out'
       where id = v_s.id;
      update time_entries set ended_at = greatest(greatest(v_end_at, v_s.clock_in_at), started_at + interval '1 minute')
       where user_id = v_s.user_id and ended_at is null;
    end if;

    if coalesce((v_fco->>'mark_requires_review')::boolean, true) or coalesce((v_fco->>'require_employee_correction')::boolean, true) then
      update attendance_records set requires_review = true,
             review_reason = case when coalesce((v_fco->>'require_employee_correction')::boolean, true)
                                  then 'Forgotten clock-out — employee correction required'
                                  else 'Forgotten clock-out — requires review' end
       where id = v_s.record_id;
    end if;

    perform bos_recalc_attendance_day(v_s.record_id);

    v_notify := '{}';
    if coalesce((v_fco->>'notify_employee')::boolean, true) then v_notify := v_notify || 'employee'; end if;
    if coalesce((v_fco->>'notify_manager')::boolean, true) then v_notify := v_notify || 'manager_of_assignee'; end if;

    perform bos_emit('attendance.open_session_detected', 'employee', v_s.employee_id, null,
      'Open work session detected for ' || v_s.full_name || ' (' || v_s.work_date || ')',
      jsonb_build_object('session_id', v_s.id, 'record_id', v_s.record_id, 'work_date', v_s.work_date,
                         'employee_user_id', v_s.user_id, 'assignee_user_id', v_s.user_id,
                         'auto_closed', coalesce((v_fco->>'auto_close_at_schedule_end')::boolean, true),
                         'correction_required', coalesce((v_fco->>'require_employee_correction')::boolean, true),
                         'notify_relations', to_jsonb(v_notify)),
      '[]'::jsonb, 'system', 'internal', 'attendance.open_session:' || v_s.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Absence marking for a past work date (run by the sweep for yesterday).
create or replace function public.bos_mark_absences(p_date date)
returns integer
language plpgsql
as $$
declare
  v_e record;
  v_sched work_schedules%rowtype;
  v_record uuid;
  v_n integer := 0;
begin
  for v_e in
    select e.* from employees e
    where e.user_id is not null and e.lifecycle_status in ('active','on_leave')
      and (e.start_date is null or e.start_date <= p_date)
      and not exists (select 1 from attendance_records r where r.user_id = e.user_id and r.work_date = p_date)
  loop
    v_sched := bos_employee_schedule(v_e.user_id);
    if extract(dow from p_date)::smallint = any(v_sched.work_days) then
      insert into attendance_records (user_id, work_date, schedule_id, timezone, is_remote)
      values (v_e.user_id, p_date, v_sched.id, coalesce(v_sched.timezone, v_e.timezone), v_e.is_remote)
      on conflict (user_id, work_date) do nothing
      returning id into v_record;
      if v_record is not null then
        perform bos_recalc_attendance_day(v_record);
        v_n := v_n + 1;
      end if;
    end if;
  end loop;
  return v_n;
end;
$$;

-- Approved correction → sessions updated/created, day recalculated, audited
-- (who, when, what changed, old value, new value, reason — §36).
create or replace function public.bos_apply_attendance_correction(p_correction uuid, p_reviewer uuid, p_comment text default null)
returns void
language plpgsql
as $$
declare
  v_c attendance_corrections%rowtype;
  v_session attendance_sessions%rowtype;
  v_record uuid;
  v_old jsonb;
  v_new jsonb;
  v_sched work_schedules%rowtype;
  v_emp employees%rowtype;
begin
  select * into v_c from attendance_corrections where id = p_correction for update;
  if v_c.id is null then
    raise exception 'Correction not found' using errcode = 'P0002';
  end if;
  if v_c.status <> 'pending' then
    raise exception 'This correction was already %', v_c.status using errcode = '22023';
  end if;

  select * into v_emp from employees where user_id = v_c.user_id;
  v_record := v_c.record_id;
  if v_record is null then
    v_sched := bos_employee_schedule(v_c.user_id);
    insert into attendance_records (user_id, work_date, schedule_id, timezone, is_remote)
    values (v_c.user_id, v_c.work_date, v_sched.id, coalesce(v_sched.timezone, v_emp.timezone), v_emp.is_remote)
    on conflict (user_id, work_date) do update set updated_at = now()
    returning id into v_record;
  end if;

  if v_c.session_id is not null then
    select * into v_session from attendance_sessions where id = v_c.session_id for update;
    v_old := jsonb_build_object('clock_in_at', v_session.clock_in_at, 'clock_out_at', v_session.clock_out_at);
    update attendance_sessions
       set clock_in_at = coalesce(v_c.requested_clock_in, clock_in_at),
           clock_out_at = coalesce(v_c.requested_clock_out, clock_out_at),
           closed_reason = 'corrected', auto_closed = false
     where id = v_c.session_id
    returning jsonb_build_object('clock_in_at', clock_in_at, 'clock_out_at', clock_out_at) into v_new;
  else
    if v_c.requested_clock_in is null then
      raise exception 'A clock-in time is required when no session exists' using errcode = '22023';
    end if;
    v_old := jsonb_build_object('session', null);
    insert into attendance_sessions (record_id, user_id, clock_in_at, clock_out_at, source, closed_reason)
    values (v_record, v_c.user_id, v_c.requested_clock_in, v_c.requested_clock_out, 'correction', 'corrected')
    returning jsonb_build_object('clock_in_at', clock_in_at, 'clock_out_at', clock_out_at) into v_new;
  end if;

  update attendance_records set requires_review = false, review_reason = null where id = v_record;
  perform bos_recalc_attendance_day(v_record);

  update attendance_corrections
     set status = 'approved', reviewed_by = p_reviewer, reviewed_at = now(), review_comment = p_comment, record_id = v_record
   where id = p_correction;

  perform bos_status('attendance_correction', p_correction, 'pending', 'approved', p_reviewer, p_comment);
  perform bos_audit(p_reviewer, 'attendance.corrected', 'attendance_record', v_record, v_old, v_new, v_c.reason,
    jsonb_build_object('correction_id', p_correction, 'employee_user_id', v_c.user_id, 'work_date', v_c.work_date, 'review_comment', p_comment));
  perform bos_emit('attendance.correction_approved', 'employee', v_emp.id, p_reviewer,
    'Attendance correction approved for ' || v_c.work_date,
    jsonb_build_object('correction_id', p_correction, 'employee_user_id', v_c.user_id, 'work_date', v_c.work_date),
    '[]'::jsonb, 'user', 'internal', 'attendance.correction_approved:' || p_correction);
end;
$$;

-- Approved leave marks attendance for each covered work day.
create or replace function public.bos_apply_leave(p_leave uuid)
returns void
language plpgsql
as $$
declare
  v_l leave_requests%rowtype;
  v_d date;
  v_sched work_schedules%rowtype;
  v_emp employees%rowtype;
  v_record uuid;
begin
  select * into v_l from leave_requests where id = p_leave;
  if v_l.status <> 'approved' then return; end if;
  select * into v_emp from employees where user_id = v_l.user_id;
  v_sched := bos_employee_schedule(v_l.user_id);

  for v_d in select generate_series(v_l.start_date, v_l.end_date, interval '1 day')::date loop
    if extract(dow from v_d)::smallint = any(v_sched.work_days) then
      insert into attendance_records (user_id, work_date, schedule_id, timezone, is_remote, status)
      values (v_l.user_id, v_d, v_sched.id, coalesce(v_sched.timezone, v_emp.timezone), v_emp.is_remote, 'leave')
      on conflict (user_id, work_date) do update set updated_at = now()
      returning id into v_record;
      perform bos_recalc_attendance_day(v_record);
    end if;
  end loop;
end;
$$;

create or replace function public.bos_leave_duration(p_user uuid, p_start date, p_end date, p_half boolean)
returns numeric
language plpgsql
stable
as $$
declare
  v_sched work_schedules%rowtype;
  v_country text;
  v_days numeric := 0;
  v_d date;
begin
  v_sched := bos_employee_schedule(p_user);
  select country into v_country from employees where user_id = p_user;
  for v_d in select generate_series(p_start, p_end, interval '1 day')::date loop
    if extract(dow from v_d)::smallint = any(v_sched.work_days)
       and not exists (select 1 from holidays h where h.date = v_d and (h.country is null or h.country = v_country)) then
      v_days := v_days + 1;
    end if;
  end loop;
  if p_half then
    return case when v_days > 0 then 0.5 else 0 end;
  end if;
  return v_days;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers, RLS, grants
-- ---------------------------------------------------------------------------

create trigger attendance_records_touch before update on attendance_records for each row execute function bos_touch_updated_at();
create trigger overtime_requests_touch before update on overtime_requests for each row execute function bos_touch_updated_at();
create trigger leave_requests_touch before update on leave_requests for each row execute function bos_touch_updated_at();
create trigger kpis_touch before update on kpis for each row execute function bos_touch_updated_at();
create trigger performance_reviews_touch before update on performance_reviews for each row execute function bos_touch_updated_at();

alter table holidays enable row level security;
alter table attendance_records enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance_breaks enable row level security;
alter table attendance_corrections enable row level security;
alter table overtime_requests enable row level security;
alter table leave_types enable row level security;
alter table leave_requests enable row level security;
alter table kpis enable row level security;
alter table kpi_assignments enable row level security;
alter table kpi_values enable row level security;
alter table performance_reviews enable row level security;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

revoke execute on function
  public.bos_kpi_actual(text, uuid, date, date),
  public.bos_employee_schedule(uuid),
  public.bos_recalc_attendance_day(uuid),
  public.bos_clock_in(uuid, text, text),
  public.bos_clock_out(uuid, text),
  public.bos_start_break(uuid),
  public.bos_end_break(uuid),
  public.bos_detect_open_sessions(),
  public.bos_mark_absences(date),
  public.bos_apply_attendance_correction(uuid, uuid, text),
  public.bos_apply_leave(uuid),
  public.bos_leave_duration(uuid, date, date, boolean)
from public, anon, authenticated;
