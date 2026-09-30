-- Hourly cost from salary (docs/bos/28 §33): use the salary in force today,
-- or — for a new hire who has not started yet — the first approved salary.
create or replace function public.bos_sync_hourly_cost(p_employee uuid)
returns void
language plpgsql
as $$
declare
  v_emp employees%rowtype;
  v_comp employee_compensation%rowtype;
  v_on date;
  v_extra numeric := 0;
  v_hours numeric := coalesce(((select value from bos_settings where key = 'payroll_policy')->'overtime'->>'standard_monthly_hours')::numeric, 176);
begin
  select * into v_emp from employees where id = p_employee;
  if v_emp.id is null or v_emp.hourly_cost_source <> 'salary' then return; end if;
  v_comp := bos_employee_salary_on(p_employee, current_date);
  if v_comp.id is null then
    select * into v_comp from employee_compensation
     where employee_id = p_employee and approval_status = 'approved'
     order by effective_from, created_at limit 1;
  end if;
  if v_comp.id is null then return; end if;
  v_on := greatest(current_date, v_comp.effective_from);
  select coalesce(sum(case when c.calc_type = 'percent_of_basic' then v_comp.basic_salary * esc.amount / 100 else esc.amount end), 0)
    into v_extra
    from employee_salary_components esc join salary_components c on c.id = esc.component_id
   where esc.employee_id = p_employee and c.kind = 'earning'
     and esc.effective_from <= v_on and (esc.effective_to is null or esc.effective_to >= v_on);
  update employees set hourly_cost = round((v_comp.basic_salary + v_extra) / greatest(v_hours, 1), 3), cost_currency = v_comp.currency
   where id = p_employee;
end;
$$;
revoke execute on function public.bos_sync_hourly_cost(uuid) from public, anon, authenticated;
