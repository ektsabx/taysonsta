-- Fix: text[] || 'literal' was parsed as array || array (runtime error).
-- Explicit ::text casts make the forgotten clock-out sweep work.
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
