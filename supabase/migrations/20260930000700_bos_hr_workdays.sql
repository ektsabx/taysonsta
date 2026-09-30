-- Working days of an employee in a range (payroll proration, unpaid leave),
-- by employee id so people without a BOS login are covered too.
create or replace function public.bos_employee_work_days(p_employee uuid, p_from date, p_to date)
returns integer
language plpgsql
stable
as $$
declare
  v_d date;
  v_n integer := 0;
  v_day bos_schedule_day_t;
begin
  if p_to < p_from then return 0; end if;
  for v_d in select generate_series(p_from, p_to, interval '1 day')::date loop
    v_day := bos_schedule_day(bos_resolve_schedule_id(p_employee, v_d), v_d);
    if coalesce(v_day.is_working, false) and bos_day_off_reason(p_employee, v_d) is null then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.bos_employee_work_days(uuid, date, date) from public, anon, authenticated;
