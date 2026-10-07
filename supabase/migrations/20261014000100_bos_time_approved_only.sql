-- Phase 15 (docs/bos/30 §22): only approved (or approval-free) hours count in
-- project cost, team hours, KPIs and task actuals. Definitions are the current
-- ones with that single filter added.

CREATE OR REPLACE FUNCTION public.bos_project_financials(p_project uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  with p as (select * from projects where id = p_project),
  collected as (
    select coalesce(sum(case when pay.currency = p.currency then pay.amount - pay.refunded_amount
                             else round((pay.amount - pay.refunded_amount) * coalesce(bos_fx_rate(pay.currency, p.currency, pay.payment_date), 0), 3) end), 0) v
    from bos_payments pay, p where pay.project_id = p.id and pay.status in ('completed','refunded')
  ),
  invoiced as (
    select coalesce(sum(i.total), 0) v, coalesce(sum(i.balance) filter (where i.status in ('sent','partially_paid','overdue')), 0) outstanding
    from bos_invoices i, p where i.project_id = p.id and i.status not in ('cancelled','draft')
  ),
  time_cost as (
    select coalesce(sum(case when te.cost_currency = p.currency or te.cost_currency is null then te.cost_amount
                             else round(te.cost_amount * coalesce(bos_fx_rate(te.cost_currency, p.currency, te.started_at::date), 0), 3) end), 0) v,
           coalesce(sum(te.duration_minutes), 0) minutes
    from time_entries te, p where te.project_id = p.id and te.ended_at is not null and te.approval_status in ('approved','not_required')
  ),
  exp as (
    select ec.cost_type,
           coalesce(sum(case when e.currency = p.currency then e.amount else round(e.amount * coalesce(bos_fx_rate(e.currency, p.currency, e.expense_date), 0), 3) end), 0) v
    from expenses e join expense_categories ec on ec.id = e.category_id, p
    where e.project_id = p.id and e.approval_status = 'approved' and e.archived_at is null
    group by ec.cost_type
  )
  select jsonb_build_object(
    'currency', (select currency from p),
    'budget', (select budget from p),
    'revenue_basis', coalesce((select value->>'profitability_revenue_basis' from bos_settings where key = 'finance'), 'collected'),
    'collected', (select v from collected),
    'invoiced', (select v from invoiced),
    'outstanding', (select outstanding from invoiced),
    'employee_cost', (select v from time_cost),
    'hours', round((select minutes from time_cost) / 60.0, 2),
    'freelancer_cost', coalesce((select v from exp where cost_type = 'freelancer'), 0),
    'vendor_cost', coalesce((select v from exp where cost_type = 'vendor'), 0),
    'infrastructure_cost', coalesce((select v from exp where cost_type = 'infrastructure'), 0),
    'third_party_cost', coalesce((select v from exp where cost_type = 'third_party'), 0),
    'other_cost', coalesce((select sum(v) from exp where cost_type in ('other','employee')), 0)
  );
$function$;

CREATE OR REPLACE FUNCTION public.bos_report_team(f jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_from date := bos_filter_from(f);
  v_to date := bos_filter_to(f);
  v_users uuid[] := bos_filter_users(f);
begin
  return coalesce((
    select jsonb_agg(x order by x->>'name') from (
      select jsonb_build_object(
        'user_id', e.user_id, 'name', e.full_name, 'department', d.name, 'position', e.position,
        'logged_hours', round(coalesce((select sum(te.duration_minutes) from time_entries te where te.user_id = e.user_id and te.started_at::date between v_from and v_to and te.approval_status in ('approved','not_required')), 0) / 60.0, 2),
        'worked_hours', round(coalesce((select sum(ar.worked_minutes) from attendance_records ar where ar.user_id = e.user_id and ar.work_date between v_from and v_to), 0) / 60.0, 2),
        'capacity_hours', round(coalesce((
            select sum(case when extract(dow from g)::smallint = any(ws.work_days)
                            then extract(epoch from (ws.end_time - ws.start_time)) / 3600 - ws.break_minutes / 60.0 else 0 end)
            from generate_series(v_from, v_to, interval '1 day') g, bos_employee_schedule(e.user_id) ws), 0), 2),
        'open_tasks', (select count(*) from tasks t where t.assigned_to = e.user_id and t.status in ('pending','in_progress','blocked','overdue') and t.archived_at is null),
        'overdue_tasks', (select count(*) from tasks t where t.assigned_to = e.user_id and t.status = 'overdue' and t.archived_at is null),
        'active_projects', (select count(*) from project_members pm join projects p on p.id = pm.project_id where pm.user_id = e.user_id and p.status not in ('completed','cancelled')),
        'present_days', (select count(*) from attendance_records ar where ar.user_id = e.user_id and ar.work_date between v_from and v_to and ar.status in ('present','overtime','remote')),
        'late_days', (select count(*) from attendance_records ar where ar.user_id = e.user_id and ar.work_date between v_from and v_to and ar.status = 'late'),
        'absent_days', (select count(*) from attendance_records ar where ar.user_id = e.user_id and ar.work_date between v_from and v_to and ar.status = 'absent'),
        'leave_days', (select count(*) from attendance_records ar where ar.user_id = e.user_id and ar.work_date between v_from and v_to and ar.status = 'leave'),
        'late_minutes', (select coalesce(sum(ar.late_minutes), 0) from attendance_records ar where ar.user_id = e.user_id and ar.work_date between v_from and v_to),
        'overtime_minutes', (select coalesce(sum(ar.overtime_minutes), 0) from attendance_records ar where ar.user_id = e.user_id and ar.work_date between v_from and v_to)
      ) x
      from employees e left join departments d on d.id = e.department_id
      where e.user_id is not null and e.archived_at is null and e.lifecycle_status not in ('archived','candidate')
        and (v_users is null or e.user_id = any(v_users)) and bos_branch_ok(f, e.branch_id)
        and (f->>'department_id' is null or e.department_id = (f->>'department_id')::uuid)
    ) s
  ), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.bos_kpi_actual(p_source text, p_user uuid, p_start date, p_end date)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
AS $function$
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
              from bos_payments p join deals d on d.id = p.deal_id
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
                from time_entries te where te.approval_status in ('approved','not_required') and te.project_id = p.id
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
              where approval_status in ('approved','not_required') and user_id = p_user and started_at >= v_from and started_at < v_to);
    else
      return null;
  end case;
end;
$function$;

CREATE OR REPLACE FUNCTION public.bos_time_entry_task_actual()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_task uuid;
begin
  for v_task in select unnest(array[new.task_id, old.task_id]) loop
    if v_task is not null then
      update tasks set actual_minutes = coalesce((select sum(duration_minutes) from time_entries where task_id = v_task and approval_status in ('approved','not_required')), 0)
       where id = v_task;
    end if;
  end loop;
  return null;
end;
$function$;
