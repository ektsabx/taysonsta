-- HR & Workforce — schedules, shifts, holidays, days off, attendance engine,
-- leave and overtime extensions (docs/bos/28 §11–15).
-- Nothing is hard-coded: per-day hours live in work_schedule_days; the
-- schedule of a person on a date resolves shift → employee → team →
-- department → company assignment → default schedule.

-- ---------------------------------------------------------------------------
-- Schedules
-- ---------------------------------------------------------------------------

alter table work_schedules
  add column schedule_type text not null default 'fixed' check (schedule_type in ('fixed','shift','night','flexible','remote')),
  add column required_minutes integer check (required_minutes is null or required_minutes between 0 and 1440),
  add column description text,
  add column color text,
  add column is_active boolean not null default true;

create table work_schedule_days (
  schedule_id uuid not null references work_schedules(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_working boolean not null default true,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0 check (break_minutes between 0 and 600),
  primary key (schedule_id, weekday)
);

-- Backfill: every existing schedule gets 7 day rows equal to its old rule.
insert into work_schedule_days (schedule_id, weekday, is_working, start_time, end_time, break_minutes)
select ws.id, d::smallint, d::smallint = any(ws.work_days), ws.start_time, ws.end_time, ws.break_minutes
from work_schedules ws cross join generate_series(0, 6) as d
on conflict do nothing;

create or replace function public.bos_schedule_seed_days()
returns trigger
language plpgsql
as $$
begin
  insert into work_schedule_days (schedule_id, weekday, is_working, start_time, end_time, break_minutes)
  select new.id, d::smallint, d::smallint = any(new.work_days), new.start_time, new.end_time, new.break_minutes
  from generate_series(0, 6) as d
  on conflict do nothing;
  return new;
end;
$$;
create trigger work_schedules_seed_days after insert on work_schedules for each row execute function bos_schedule_seed_days();

-- Keep the legacy summary columns (work_days, start/end, break) in sync so
-- every older reader keeps working.
create or replace function public.bos_schedule_sync_summary()
returns trigger
language plpgsql
as $$
declare
  v_id uuid := coalesce(new.schedule_id, old.schedule_id);
  v_first work_schedule_days%rowtype;
begin
  select * into v_first from work_schedule_days where schedule_id = v_id and is_working order by (weekday + 1) % 7 limit 1;
  update work_schedules set
    work_days = coalesce((select array_agg(weekday order by weekday) from work_schedule_days where schedule_id = v_id and is_working), '{}'),
    start_time = coalesce(v_first.start_time, start_time),
    end_time = coalesce(v_first.end_time, end_time),
    break_minutes = coalesce(v_first.break_minutes, break_minutes),
    updated_at = now()
  where id = v_id;
  return null;
end;
$$;
create trigger work_schedule_days_sync after insert or update or delete on work_schedule_days for each row execute function bos_schedule_sync_summary();

create table schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references work_schedules(id) on delete cascade,
  scope text not null check (scope in ('company','department','team','employee')),
  department_id uuid references departments(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,
  effective_from date not null default current_date,
  effective_to date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  check (
    (scope = 'company' and department_id is null and team_id is null and employee_id is null) or
    (scope = 'department' and department_id is not null and team_id is null and employee_id is null) or
    (scope = 'team' and team_id is not null and department_id is null and employee_id is null) or
    (scope = 'employee' and employee_id is not null and department_id is null and team_id is null)
  )
);
create index schedule_assignments_lookup_idx on schedule_assignments (scope, effective_from desc);

-- Date-specific shifts (Shift A / Shift B / night rota).
create table shift_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null,
  schedule_id uuid not null references work_schedules(id) on delete cascade,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

-- ---------------------------------------------------------------------------
-- Holidays & custom days off
-- ---------------------------------------------------------------------------

alter table holidays
  add column kind text not null default 'public' check (kind in ('public','company')),
  add column is_paid boolean not null default true,
  add column notes text;

create table employee_days_off (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('employee','team','department')),
  employee_id uuid references employees(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  department_id uuid references departments(id) on delete cascade,
  date date not null,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (scope = 'employee' and employee_id is not null) or
    (scope = 'team' and team_id is not null) or
    (scope = 'department' and department_id is not null)
  )
);
create index employee_days_off_date_idx on employee_days_off (date);

-- Existing employees pinned to the default schedule now inherit it
-- (identical result today; lets team/department schedules apply).
update employees set work_schedule_id = null
where work_schedule_id = (select id from work_schedules where is_default order by created_at limit 1);

-- ---------------------------------------------------------------------------
-- Resolution helpers
-- ---------------------------------------------------------------------------

create type bos_schedule_day_t as (
  is_working boolean,
  start_time time,
  end_time time,
  break_minutes integer,
  flexible boolean,
  required_minutes integer,
  overnight boolean
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
    (select sa.schedule_id from schedule_assignments sa
      where sa.scope = 'company'
        and p_date >= sa.effective_from and (sa.effective_to is null or p_date <= sa.effective_to)
      order by sa.effective_from desc, sa.created_at desc limit 1),
    (select id from work_schedules where is_default order by created_at limit 1)
  );
$$;

create or replace function public.bos_employee_schedule_on(p_user uuid, p_date date)
returns work_schedules
language sql
stable
as $$
  select ws.* from work_schedules ws
  where ws.id = coalesce(bos_resolve_schedule_id((select id from employees where user_id = p_user), p_date),
                         (select id from work_schedules where is_default order by created_at limit 1));
$$;

-- Same signature as before: the schedule that applies today (employee tz).
create or replace function public.bos_employee_schedule(p_user uuid)
returns work_schedules
language sql
stable
as $$
  select * from bos_employee_schedule_on(
    p_user,
    (now() at time zone coalesce((select timezone from employees where user_id = p_user), 'Africa/Cairo'))::date
  );
$$;

create or replace function public.bos_schedule_day(p_schedule uuid, p_date date)
returns bos_schedule_day_t
language sql
stable
as $$
  select row(
    coalesce(d.is_working, extract(dow from p_date)::smallint = any(ws.work_days)),
    coalesce(d.start_time, ws.start_time),
    coalesce(d.end_time, ws.end_time),
    coalesce(d.break_minutes, ws.break_minutes),
    ws.schedule_type = 'flexible',
    ws.required_minutes,
    coalesce(d.end_time, ws.end_time) <= coalesce(d.start_time, ws.start_time)
  )::bos_schedule_day_t
  from work_schedules ws
  left join work_schedule_days d on d.schedule_id = ws.id and d.weekday = extract(dow from p_date)::smallint
  where ws.id = p_schedule;
$$;

-- 'holiday' (public/company holiday for the employee's country), 'custom'
-- (employee/team/department day off) or null.
create or replace function public.bos_day_off_reason(p_employee uuid, p_date date)
returns text
language sql
stable
as $$
  select case
    when exists (select 1 from holidays h, employees e where e.id = p_employee and h.date = p_date and (h.country is null or h.country = e.country)) then 'holiday'
    when exists (select 1 from employee_days_off o, employees e where e.id = p_employee and o.date = p_date and (
            (o.scope = 'employee' and o.employee_id = e.id) or
            (o.scope = 'team' and o.team_id = e.team_id) or
            (o.scope = 'department' and o.department_id = e.department_id))) then 'custom'
    else null
  end;
$$;

create or replace function public.bos_is_work_day(p_user uuid, p_date date)
returns boolean
language plpgsql
stable
as $$
declare
  v_emp uuid;
  v_day bos_schedule_day_t;
begin
  select id into v_emp from employees where user_id = p_user;
  v_day := bos_schedule_day((bos_employee_schedule_on(p_user, p_date)).id, p_date);
  return coalesce(v_day.is_working, false) and bos_day_off_reason(v_emp, p_date) is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Attendance engine (per-day rules, day off, overtime basis)
-- ---------------------------------------------------------------------------

create or replace function public.bos_recalc_attendance_day(p_record uuid)
returns void
language plpgsql
as $$
declare
  v_rec attendance_records%rowtype;
  v_sched work_schedules%rowtype;
  v_day bos_schedule_day_t;
  v_policy jsonb := coalesce((select value from bos_settings where key = 'attendance_policy'), '{}'::jsonb);
  v_basis text;
  v_emp_id uuid;
  v_off text;
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
  v_start_ts timestamptz;
  v_end_ts timestamptz;
begin
  select * into v_rec from attendance_records where id = p_record for update;
  if v_rec.id is null then return; end if;
  v_basis := coalesce(v_policy->>'overtime_basis', 'after_schedule_end');

  select * into v_sched from work_schedules where id = v_rec.schedule_id;
  if v_sched.id is null then
    v_sched := bos_employee_schedule_on(v_rec.user_id, v_rec.work_date);
  end if;
  v_day := bos_schedule_day(v_sched.id, v_rec.work_date);
  select id into v_emp_id from employees where user_id = v_rec.user_id;
  v_off := bos_day_off_reason(v_emp_id, v_rec.work_date);
  v_is_holiday := v_off = 'holiday';
  v_is_work_day := coalesce(v_day.is_working, false) and v_off is null;

  select lr.*, lt.key as type_key into v_leave from leave_requests lr join leave_types lt on lt.id = lr.leave_type_id
   where lr.user_id = v_rec.user_id and lr.status = 'approved' and v_rec.work_date between lr.start_date and lr.end_date
   limit 1;

  if v_is_work_day then
    if v_day.flexible then
      v_expected := coalesce(v_day.required_minutes, 480);
    else
      v_expected := extract(epoch from (v_day.end_time - v_day.start_time))::integer / 60;
      if v_day.overnight then v_expected := v_expected + 1440; end if;
      if not coalesce((v_policy->>'expected_includes_break')::boolean, true) then
        v_expected := v_expected - v_day.break_minutes;
      end if;
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
  if coalesce((v_policy->>'deduct_scheduled_break')::boolean, false) and v_breaks = 0 and v_worked > coalesce(v_day.break_minutes, 0) then
    v_worked := v_worked - coalesce(v_day.break_minutes, 0);
    v_breaks := coalesce(v_day.break_minutes, 0);
  end if;

  if v_is_work_day and not coalesce(v_day.flexible, false) then
    v_start_ts := (v_rec.work_date + v_day.start_time) at time zone v_rec.timezone;
    v_end_ts := (v_rec.work_date + v_day.end_time) at time zone v_rec.timezone;
    if v_day.overnight then v_end_ts := v_end_ts + interval '1 day'; end if;
  end if;

  if v_first is not null and v_start_ts is not null and v_leave.id is null then
    if v_first > v_start_ts + make_interval(mins => v_sched.grace_minutes) then
      v_late := floor(extract(epoch from (v_first - v_start_ts)) / 60)::integer;
    end if;
  end if;

  if v_first is not null and not coalesce(v_open_session, false) then
    if v_expected > 0 then
      if v_basis = 'after_schedule_end' and v_end_ts is not null and v_last is not null then
        v_overtime := least(v_worked, greatest(0, floor(extract(epoch from (v_last - v_end_ts)) / 60)::integer - v_sched.overtime_after_minutes));
      else
        v_overtime := greatest(0, v_worked - v_expected - v_sched.overtime_after_minutes);
      end if;
    else
      v_overtime := v_worked;
    end if;
  end if;

  v_status := case
    when v_first is null and v_leave.id is not null then 'leave'
    when v_first is null and v_is_holiday then 'holiday'
    when v_first is null and not v_is_work_day then 'day_off'
    when v_first is null then 'absent'
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
  v_prev work_schedules%rowtype;
  v_pday bos_schedule_day_t;
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

  v_tz := coalesce(v_emp.timezone, 'Africa/Cairo');
  v_date := (now() at time zone v_tz)::date;
  v_sched := bos_employee_schedule_on(p_user, v_date);
  v_tz := coalesce(v_sched.timezone, v_tz);
  v_date := (now() at time zone v_tz)::date;

  -- A night shift that started yesterday still owns the early hours.
  v_prev := bos_employee_schedule_on(p_user, v_date - 1);
  v_pday := bos_schedule_day(v_prev.id, v_date - 1);
  if coalesce(v_pday.is_working, false) and coalesce(v_pday.overnight, false) and (now() at time zone v_tz)::time < v_pday.end_time then
    v_date := v_date - 1;
    v_sched := v_prev;
  end if;

  insert into attendance_records (user_id, work_date, schedule_id, timezone, is_remote)
  values (p_user, v_date, v_sched.id, v_tz, v_emp.is_remote or v_sched.schedule_type = 'remote')
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

create or replace function public.bos_detect_open_sessions()
returns integer
language plpgsql
as $$
declare
  v_policy jsonb := coalesce((select value from bos_settings where key = 'attendance_policy'), '{}'::jsonb);
  v_fco jsonb := coalesce(v_policy->'forgotten_clock_out', '{}'::jsonb);
  v_after integer := coalesce((v_policy->>'auto_close_after_minutes')::int, 120);
  v_s record;
  v_day bos_schedule_day_t;
  v_end_at timestamptz;
  v_n integer := 0;
  v_notify text[];
begin
  for v_s in
    select s.*, r.work_date, r.timezone, r.schedule_id, e.id as employee_id, e.full_name
    from attendance_sessions s
    join attendance_records r on r.id = s.record_id
    join employees e on e.user_id = s.user_id
    where s.clock_out_at is null
    for update of s skip locked
  loop
    v_day := bos_schedule_day(coalesce(v_s.schedule_id, (bos_employee_schedule_on(v_s.user_id, v_s.work_date)).id), v_s.work_date);
    if coalesce(v_day.flexible, false) then
      v_end_at := v_s.clock_in_at + make_interval(mins => coalesce(v_day.required_minutes, 480) + coalesce(v_day.break_minutes, 0));
    else
      v_end_at := ((v_s.work_date + coalesce(v_day.end_time, '18:00'::time)) at time zone v_s.timezone);
      if coalesce(v_day.overnight, false) then v_end_at := v_end_at + interval '1 day'; end if;
    end if;
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
    if coalesce((v_fco->>'notify_employee')::boolean, true) then v_notify := v_notify || 'employee'::text; end if;
    if coalesce((v_fco->>'notify_manager')::boolean, true) then v_notify := v_notify || 'manager_of_assignee'::text; end if;

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
    if bos_is_work_day(v_e.user_id, p_date) then
      v_sched := bos_employee_schedule_on(v_e.user_id, p_date);
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

  for v_d in select generate_series(v_l.start_date, v_l.end_date, interval '1 day')::date loop
    if bos_is_work_day(v_l.user_id, v_d) then
      v_sched := bos_employee_schedule_on(v_l.user_id, v_d);
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
  v_days numeric := 0;
  v_d date;
begin
  for v_d in select generate_series(p_start, p_end, interval '1 day')::date loop
    if bos_is_work_day(p_user, v_d) then
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
-- Leave extensions (§14)
-- ---------------------------------------------------------------------------

alter table leave_types
  add column approval_steps text[],
  add column carry_forward_max_days numeric(5,1) check (carry_forward_max_days is null or carry_forward_max_days >= 0),
  add column max_consecutive_days numeric(5,1) check (max_consecutive_days is null or max_consecutive_days > 0),
  add column min_notice_days integer check (min_notice_days is null or min_notice_days >= 0),
  add column eligible_gender text check (eligible_gender is null or eligible_gender in ('male','female')),
  add column color text;

insert into leave_types (key, name, is_paid, annual_allowance_days, requires_approval, requires_reason, is_active, sort_order, eligible_gender, max_consecutive_days) values
  ('emergency', 'إجازة طارئة', true, 3, true, true, true, 25, null, 3),
  ('casual', 'إجازة عارضة', true, 6, true, false, true, 26, null, 2),
  ('maternity', 'إجازة وضع (أمومة)', true, 90, true, false, true, 40, 'female', null),
  ('paternity', 'إجازة أبوة', true, 3, true, false, true, 41, 'male', null),
  ('other', 'إجازة أخرى', false, null, true, true, true, 90, null, null)
on conflict (key) do nothing;

create table leave_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id) on delete restrict,
  year integer not null check (year between 2000 and 2100),
  days numeric(5,1) not null check (days <> 0),
  kind text not null default 'adjustment' check (kind in ('adjustment','carry_forward','allowance_override')),
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index leave_balance_adjustments_user_idx on leave_balance_adjustments (user_id, year);

-- ---------------------------------------------------------------------------
-- Overtime extensions (§15)
-- ---------------------------------------------------------------------------

alter table overtime_requests
  add column actual_minutes integer,
  add column approved_minutes integer check (approved_minutes is null or approved_minutes >= 0),
  add column day_type text not null default 'workday' check (day_type in ('workday','day_off','holiday')),
  add column rate_multiplier numeric(5,2),
  add column amount numeric(14,3),
  add column currency char(3),
  add column payslip_id uuid;

-- Existing approved requests: approved minutes = requested minutes.
update overtime_requests set approved_minutes = minutes where status = 'approved' and approved_minutes is null;
update overtime_requests o set actual_minutes = r.overtime_minutes
from attendance_records r where r.user_id = o.user_id and r.work_date = o.work_date and o.actual_minutes is null;

-- ---------------------------------------------------------------------------
-- Policy defaults, RLS, grants, recalculation of existing records
-- ---------------------------------------------------------------------------

update bos_settings set value = value || jsonb_build_object('overtime_basis', 'after_schedule_end')
where key = 'attendance_policy' and not (value ? 'overtime_basis');

alter table work_schedule_days enable row level security;
alter table schedule_assignments enable row level security;
alter table shift_assignments enable row level security;
alter table employee_days_off enable row level security;
alter table leave_balance_adjustments enable row level security;

grant all on all tables in schema public to service_role;

revoke execute on function
  public.bos_resolve_schedule_id(uuid, date),
  public.bos_employee_schedule_on(uuid, date),
  public.bos_schedule_day(uuid, date),
  public.bos_day_off_reason(uuid, date),
  public.bos_is_work_day(uuid, date)
from public, anon, authenticated;

-- Re-evaluate stored days with the new rules (non-working days become
-- day_off instead of holiday; overtime per the configured basis). Sessions,
-- corrections and leave are the inputs, so nothing is lost.
do $$
declare
  r record;
begin
  for r in select id from attendance_records loop
    perform bos_recalc_attendance_day(r.id);
  end loop;
end;
$$;
