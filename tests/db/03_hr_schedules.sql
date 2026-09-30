-- HR schedules (docs/bos/28 §12–13): resolution precedence date shift →
-- employee → team → department → company → default; day-off reasons;
-- working-day counting; night shifts; candidate linking trigger.
-- Runs inside a transaction that is always rolled back.
\set ON_ERROR_STOP on
begin;

do $$
declare
  v_dept uuid;
  v_team uuid;
  v_emp uuid;
  v_default uuid := (select id from work_schedules where is_default limit 1);
  v_company uuid;
  v_dept_s uuid;
  v_team_s uuid;
  v_emp_s uuid;
  v_shift uuid;
  v_night uuid;
  v_day bos_schedule_day_t;
  v_blocked boolean := false;
  v_job uuid;
  v_app1 uuid;
  v_app2 uuid;
begin
  insert into departments (name) values ('Sched Test Dept') returning id into v_dept;
  insert into teams (name, department_id) values ('Sched Test Team', v_dept) returning id into v_team;
  insert into employees (full_name, department_id, team_id, timezone, lifecycle_status, country) values ('Sched Tester', v_dept, v_team, 'Africa/Cairo', 'active', 'Egypt') returning id into v_emp;

  insert into work_schedules (name, work_days, start_time, end_time) values ('S company', '{0,1,2,3,4}', '08:00', '16:00') returning id into v_company;
  insert into work_schedules (name, work_days, start_time, end_time) values ('S dept', '{0,1,2,3,4}', '09:00', '17:00') returning id into v_dept_s;
  insert into work_schedules (name, work_days, start_time, end_time) values ('S team', '{0,1,2,3,4}', '10:00', '18:00') returning id into v_team_s;
  insert into work_schedules (name, work_days, start_time, end_time) values ('S emp', '{0,1,2,3,4}', '11:00', '19:00') returning id into v_emp_s;
  insert into work_schedules (name, work_days, start_time, end_time, schedule_type) values ('S shift', '{0,1,2,3,4,5,6}', '14:00', '22:00', 'shift') returning id into v_shift;

  assert (select count(*) from work_schedule_days where schedule_id = v_company) = 7, 'every schedule gets 7 day rows';
  assert bos_resolve_schedule_id(v_emp, '2031-03-02') = v_default, 'nothing assigned → company default schedule';

  insert into schedule_assignments (schedule_id, scope, effective_from) values (v_company, 'company', '2031-01-01');
  assert bos_resolve_schedule_id(v_emp, '2031-03-02') = v_company, 'company assignment';
  insert into schedule_assignments (schedule_id, scope, department_id, effective_from) values (v_dept_s, 'department', v_dept, '2031-01-01');
  assert bos_resolve_schedule_id(v_emp, '2031-03-02') = v_dept_s, 'department beats company';
  insert into schedule_assignments (schedule_id, scope, team_id, effective_from) values (v_team_s, 'team', v_team, '2031-01-01');
  assert bos_resolve_schedule_id(v_emp, '2031-03-02') = v_team_s, 'team beats department';
  insert into schedule_assignments (schedule_id, scope, employee_id, effective_from, effective_to) values (v_emp_s, 'employee', v_emp, '2031-03-01', '2031-03-31');
  assert bos_resolve_schedule_id(v_emp, '2031-03-02') = v_emp_s, 'employee assignment beats team';
  assert bos_resolve_schedule_id(v_emp, '2031-04-02') = v_team_s, 'employee assignment is date-bounded';
  insert into shift_assignments (employee_id, work_date, schedule_id) values (v_emp, '2031-03-02', v_shift);
  assert bos_resolve_schedule_id(v_emp, '2031-03-02') = v_shift, 'date shift beats everything';

  -- Per-day hours: make Thursday a short day on the employee schedule.
  update work_schedule_days set start_time = '09:00', end_time = '13:00' where schedule_id = v_emp_s and weekday = 4;
  v_day := bos_schedule_day(v_emp_s, '2031-03-06'); -- Thursday
  assert v_day.start_time = '09:00' and v_day.end_time = '13:00', 'per-day hours';
  v_day := bos_schedule_day(v_emp_s, '2031-03-07'); -- Friday
  assert not v_day.is_working, 'Friday off';

  -- Day-off reasons
  insert into holidays (date, name, kind) values ('2031-03-03', 'T holiday', 'company');
  insert into employee_days_off (scope, team_id, date, reason) values ('team', v_team, '2031-03-04', 'Team offsite');
  assert bos_day_off_reason(v_emp, '2031-03-03') = 'holiday';
  assert bos_day_off_reason(v_emp, '2031-03-04') = 'custom';
  assert bos_day_off_reason(v_emp, '2031-03-05') is null;
  -- Sun 2..Sat 8 March 2031 with the employee schedule (Sun–Thu) minus the
  -- shift day (Sunday is a working shift day), holiday (Mon) and day off (Tue):
  -- Sun(shift ✓) + Wed + Thu = 3
  assert bos_employee_work_days(v_emp, '2031-03-02', '2031-03-08') = 3, 'working days honour shifts, holidays, days off, weekends';

  -- Night shifts may cross midnight; other schedules may not.
  insert into work_schedules (name, work_days, start_time, end_time, schedule_type) values ('S night', '{0,1,2,3,4}', '22:00', '06:00', 'night') returning id into v_night;
  v_day := bos_schedule_day(v_night, '2031-03-02');
  assert v_day.overnight, 'night schedule is overnight';
  begin
    insert into work_schedules (name, work_days, start_time, end_time) values ('bad', '{0}', '22:00', '06:00');
  exception when check_violation then
    v_blocked := true;
  end;
  assert v_blocked, 'a fixed schedule cannot end before it starts';

  -- Candidates are linked by e-mail when the website inserts an application.
  select id into v_job from career_jobs limit 1;
  if v_job is not null then
    insert into career_applications (job_id, first_name, last_name, phone, email, instagram_handle, country, age, education_status, bio, why_fit, expected_salary)
    values (v_job, 'A', 'B', '1', 'Link.Test@Example.test', '-', 'EG', 20, '-', '-', '-', '-') returning id into v_app1;
    insert into career_applications (job_id, first_name, last_name, phone, email, instagram_handle, country, age, education_status, bio, why_fit, expected_salary)
    values (v_job, 'A', 'B', '1', 'link.test@example.test', '-', 'EG', 20, '-', '-', '-', '-') returning id into v_app2;
    assert (select candidate_id from career_applications where id = v_app1) = (select candidate_id from career_applications where id = v_app2), 'same person → one candidate';
  end if;

  raise notice 'hr schedules: ok';
end;
$$;

rollback;
