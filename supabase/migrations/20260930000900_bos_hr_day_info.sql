-- Schedule facts for one person on one day (Attendance Today / HR overview):
-- schedule, scheduled start/end, working day, day-off reason, approved leave.
create or replace function public.bos_employee_day_info(p_user uuid, p_date date)
returns jsonb
language plpgsql
stable
as $$
declare
  v_emp uuid;
  v_sched work_schedules%rowtype;
  v_day bos_schedule_day_t;
  v_off text;
  v_leave text;
begin
  select id into v_emp from employees where user_id = p_user;
  v_sched := bos_employee_schedule_on(p_user, p_date);
  v_day := bos_schedule_day(v_sched.id, p_date);
  v_off := bos_day_off_reason(v_emp, p_date);
  select lt.name into v_leave from leave_requests lr join leave_types lt on lt.id = lr.leave_type_id
   where lr.user_id = p_user and lr.status = 'approved' and p_date between lr.start_date and lr.end_date limit 1;
  return jsonb_build_object(
    'schedule_id', v_sched.id,
    'schedule_name', v_sched.name,
    'schedule_type', v_sched.schedule_type,
    'is_working', coalesce(v_day.is_working, false) and v_off is null,
    'start_time', to_char(v_day.start_time, 'HH24:MI'),
    'end_time', to_char(v_day.end_time, 'HH24:MI'),
    'flexible', coalesce(v_day.flexible, false),
    'off_reason', v_off,
    'leave', v_leave
  );
end;
$$;
revoke execute on function public.bos_employee_day_info(uuid, date) from public, anon, authenticated;
