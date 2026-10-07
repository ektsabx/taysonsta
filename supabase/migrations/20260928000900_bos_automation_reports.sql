-- Taysonsta BOS — Phase 8: automation engine, reports, global search.
-- See docs/bos/20-automation.md and 21-reports.md.

create table automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  trigger_event text not null,
  conditions jsonb not null default '[]'::jsonb check (jsonb_typeof(conditions) = 'array'),
  condition_logic text not null default 'all' check (condition_logic in ('all','any')),
  actions jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array'),
  is_active boolean not null default true,
  is_system boolean not null default false,
  run_once_per_entity boolean not null default false,
  priority integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index automation_rules_trigger_idx on automation_rules (trigger_event) where is_active;

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references automation_rules(id) on delete cascade,
  event_id bigint references activity_events(id) on delete set null,
  entity_type text,
  entity_id uuid,
  status text not null check (status in ('running','success','failed','skipped')),
  error text,
  results jsonb not null default '[]'::jsonb,
  rule_snapshot jsonb,
  is_retry boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index automation_runs_rule_event_idx on automation_runs (rule_id, event_id) where not is_retry;
create index automation_runs_rule_entity_idx on automation_runs (rule_id, entity_type, entity_id, status);
create index automation_runs_started_idx on automation_runs (started_at desc);

insert into automation_rules (name, description, trigger_event, conditions, actions, is_system, priority) values
('Deal won — delivery kickoff',
 'Core records (client, project, payment schedule, invoice, tasks, commission, onboarding) are created atomically by the Deal Won function. This workflow posts the kickoff message and emails the client.',
 'deal.won', '[{"field":"has_payment_terms","op":"eq","value":true}]',
 '[{"type":"ensure_project_channel","params":{}},
   {"type":"post_system_message","params":{"channel":"project","text":"Deal {{payload.deal_id}} won — project created. Welcome to the team!"}},
   {"type":"send_email","params":{"to":"client_primary_contact","subject":"Welcome to Taysonsta","body":"Thank you for choosing Taysonsta. Your project has been created and your project manager will contact you shortly."}}]',
 true, 100),
('High-value deal won',
 'WHEN deal won IF value > 10,000 USD THEN assign senior PM, create onboarding checklist, notify Finance.',
 'deal.won', '[{"field":"value_base","op":"gt","value":10000}]',
 '[{"type":"assign_pm","params":{"strategy":"senior_pool"}},
   {"type":"create_onboarding_checklist","params":{"template":"client_onboarding"}},
   {"type":"notify","params":{"recipients":[{"kind":"role","value":"finance"}],"title":"High-value deal won","body":"A deal above 10,000 USD was won. Please review invoicing and payment schedule."}}]',
 true, 90),
('Task overdue — manager escalation',
 'WHEN task overdue IF overdue more than 2 days THEN notify the assignee''s manager.',
 'task.overdue', '[{"field":"overdue_days","op":"gt","value":2}]',
 '[{"type":"notify","params":{"recipients":[{"kind":"relation","value":"manager_of_assignee"}],"title":"Escalation: overdue work","body":"{{summary}} has been overdue for {{payload.overdue_days}} days."}}]',
 true, 50),
('Lead routing',
 'WHEN lead created IF unassigned THEN assign a Business Development owner (round robin).',
 'lead.created', '[{"field":"assigned_to","op":"not_exists"}]',
 '[{"type":"assign_record","params":{"entity":"lead","strategy":"round_robin","role":"business_development"}}]',
 true, 100),
('Meeting follow-up',
 'After a meeting is completed create a follow-up task for the organizer (§82).',
 'meeting.completed', '[]',
 '[{"type":"create_task","params":{"title":"Follow up: {{payload.title}}","assignee":"relation:assignee","due_offset_days":1,"priority":"high","link_from_payload":true}}]',
 true, 100),
('Payment received — project update',
 'Post a system message in the project channel when a payment completes.',
 'payment.completed', '[{"field":"project_id","op":"exists"}]',
 '[{"type":"post_system_message","params":{"channel":"project","text":"Payment received: {{payload.amount}} {{payload.currency}}."}}]',
 true, 50),
('Invoice overdue — follow-up task',
 'Create a follow-up task for the account manager (or Finance) when an invoice becomes overdue.',
 'invoice.overdue', '[]',
 '[{"type":"create_task","params":{"title":"Collect overdue invoice ({{payload.balance}} {{payload.currency}})","assignee":"relation:account_manager","fallback_role":"finance","due_offset_days":1,"priority":"high","link_from_payload":true}}]',
 true, 50),
('Project completed — satisfaction & upsell',
 'Ask the client for satisfaction feedback and create an upsell review task for the account manager.',
 'project.completed', '[]',
 '[{"type":"create_task","params":{"title":"Upsell review for completed project","assignee":"relation:account_manager","fallback_role":"account_manager","due_offset_days":7,"priority":"medium","link_from_payload":true}},
   {"type":"send_email","params":{"to":"client_primary_contact","subject":"How did we do?","body":"Your project is complete. Please rate your experience from 1 to 10 in the client portal."}}]',
 true, 50),
('Employee created — onboarding & access',
 'Create the employee onboarding checklist and the role-based access checklist.',
 'employee.created', '[]',
 '[{"type":"create_onboarding_checklist","params":{"template":"employee_onboarding"}},
   {"type":"generate_access_checklist","params":{}}]',
 true, 100),
('Project created — project channel',
 'Create the internal project channel with the project team.',
 'project.created', '[]',
 '[{"type":"ensure_project_channel","params":{}}]',
 true, 100);

update automation_rules set run_once_per_entity = true where name = 'Task overdue — manager escalation';

-- ---------------------------------------------------------------------------
-- Reporting helpers
-- ---------------------------------------------------------------------------

create or replace function public.bos_base_currency()
returns char(3)
language sql
stable
as $$
  select coalesce((select value->>'base_currency' from bos_settings where key = 'company'), 'USD')::char(3);
$$;

create or replace function public.bos_to_base(p_amount numeric, p_currency char(3), p_date date default current_date)
returns numeric
language sql
stable
as $$
  select case when p_amount is null then null
              else round(p_amount * bos_fx_rate(p_currency, bos_base_currency(), p_date), 3) end;
$$;

-- Common filter parsing: returns (from, to, user_ids).
create or replace function public.bos_filter_from(f jsonb) returns date language sql immutable as $$
  select coalesce(nullif(f->>'from', '')::date, date_trunc('month', current_date)::date);
$$;
create or replace function public.bos_filter_to(f jsonb) returns date language sql immutable as $$
  select coalesce(nullif(f->>'to', '')::date, current_date);
$$;
create or replace function public.bos_filter_users(f jsonb) returns uuid[] language sql immutable as $$
  select case when f ? 'user_ids' and jsonb_typeof(f->'user_ids') = 'array'
              then array(select jsonb_array_elements_text(f->'user_ids')::uuid) end;
$$;

create or replace function public.bos_report_sales(f jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_from date := bos_filter_from(f);
  v_to date := bos_filter_to(f);
  v_users uuid[] := bos_filter_users(f);
  v_tf timestamptz := v_from::timestamptz;
  v_tt timestamptz := (v_to + 1)::timestamptz;
  r jsonb;
begin
  with l as (
    select l.* from leads l
    where (v_users is null or l.assigned_to = any(v_users))
      and (f->>'country' is null or l.country = f->>'country')
      and (f->>'source_id' is null or l.source_id = (f->>'source_id')::uuid)
      and (f->>'product_id' is null or l.product_interest_id = (f->>'product_id')::uuid)
  ), d as (
    select d.*, c.country as client_country from deals d join clients c on c.id = d.client_id
    where (v_users is null or d.assigned_to = any(v_users))
      and (f->>'country' is null or c.country = f->>'country')
      and (f->>'source_id' is null or d.source_id = (f->>'source_id')::uuid)
      and (f->>'client_id' is null or d.client_id = (f->>'client_id')::uuid)
      and (f->>'product_id' is null or exists (select 1 from deal_products dp where dp.deal_id = d.id and dp.product_id = (f->>'product_id')::uuid))
  ), qualified as (
    select count(distinct sh.entity_id) n from status_history sh join l on l.id = sh.entity_id
    where sh.entity_type = 'lead' and sh.to_status = 'qualified' and sh.changed_at >= v_tf and sh.changed_at < v_tt
  ), won as (
    select count(*) n, coalesce(sum(bos_to_base(value, currency, won_at::date)), 0) v,
           count(*) filter (where bos_fx_rate(currency, bos_base_currency(), won_at::date) is null) missing_rate
    from d where won_at >= v_tf and won_at < v_tt
  ), lost as (
    select count(*) n from d where lost_at >= v_tf and lost_at < v_tt
  ), created_deals as (
    select count(*) n from d where created_at >= v_tf and created_at < v_tt
  )
  select jsonb_build_object(
    'from', v_from, 'to', v_to, 'base_currency', bos_base_currency(),
    'leads', (select count(*) from l where created_at >= v_tf and created_at < v_tt),
    'qualified', (select n from qualified),
    'meetings', (select count(*) from meetings m where m.start_at >= v_tf and m.start_at < v_tt and m.status = 'completed'
                   and (v_users is null or m.organizer_id = any(v_users))),
    'proposals', (select count(*) from proposals p where p.sent_at >= v_tf and p.sent_at < v_tt and (v_users is null or p.owner_id = any(v_users))),
    'won', (select n from won),
    'lost', (select n from lost),
    'revenue', (select v from won),
    'missing_rates', (select missing_rate from won),
    'deals_created', (select n from created_deals),
    'conversion', case when (select n from created_deals) > 0 then round(100.0 * (select n from won) / (select n from created_deals), 2) else 0 end,
    'by_source', coalesce((select jsonb_agg(x order by x->>'source') from (
        select jsonb_build_object('source', coalesce(ls.name, 'Unknown'), 'leads', count(*),
               'won', count(*) filter (where l.converted_deal_id is not null and exists (select 1 from deals dd where dd.id = l.converted_deal_id and dd.won_at is not null))) x
        from l left join lead_sources ls on ls.id = l.source_id
        where l.created_at >= v_tf and l.created_at < v_tt group by ls.name) s), '[]'::jsonb),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
        'leads', (select count(*) from l where date_trunc('month', l.created_at) = m),
        'won', (select count(*) from d where date_trunc('month', d.won_at) = m),
        'revenue', (select coalesce(sum(bos_to_base(value, currency, won_at::date)), 0) from d where date_trunc('month', d.won_at) = m)) order by m)
      from generate_series(date_trunc('month', v_to::timestamp) - interval '11 months', date_trunc('month', v_to::timestamp), interval '1 month') m), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

create or replace function public.bos_report_revenue(f jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_from date := bos_filter_from(f);
  v_to date := bos_filter_to(f);
  v_client uuid := nullif(f->>'client_id', '')::uuid;
  v_project uuid := nullif(f->>'project_id', '')::uuid;
  r jsonb;
begin
  with inv as (
    select i.* from bos_invoices i
    where i.status <> 'cancelled'
      and (v_client is null or i.client_id = v_client)
      and (v_project is null or i.project_id = v_project)
  ), pay as (
    select p.* from bos_payments p
    where p.status in ('completed','refunded')
      and (v_client is null or p.client_id = v_client)
      and (v_project is null or p.project_id = v_project)
  )
  select jsonb_build_object(
    'from', v_from, 'to', v_to, 'base_currency', bos_base_currency(),
    'revenue', (select coalesce(sum(bos_to_base(total, currency, issue_date)), 0) from inv where status <> 'draft' and issue_date between v_from and v_to),
    'collected', (select coalesce(sum(bos_to_base(amount - refunded_amount, currency, payment_date)), 0) from pay where payment_date between v_from and v_to),
    'outstanding', (select coalesce(sum(bos_to_base(balance, currency, issue_date)), 0) from inv where status in ('sent','partially_paid','overdue')),
    'overdue', (select coalesce(sum(bos_to_base(balance, currency, issue_date)), 0) from inv where status in ('sent','partially_paid','overdue') and due_date < current_date),
    'by_currency', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'invoiced', invoiced, 'outstanding', outstanding)) from (
        select currency, sum(total) filter (where issue_date between v_from and v_to and status <> 'draft') invoiced,
               sum(balance) filter (where status in ('sent','partially_paid','overdue')) outstanding
        from inv group by currency) c), '[]'::jsonb),
    'aging', jsonb_build_object(
        'd0_30', (select coalesce(sum(bos_to_base(balance, currency, issue_date)), 0) from inv where status in ('sent','partially_paid','overdue') and current_date - due_date between 1 and 30),
        'd31_60', (select coalesce(sum(bos_to_base(balance, currency, issue_date)), 0) from inv where status in ('sent','partially_paid','overdue') and current_date - due_date between 31 and 60),
        'd61_90', (select coalesce(sum(bos_to_base(balance, currency, issue_date)), 0) from inv where status in ('sent','partially_paid','overdue') and current_date - due_date between 61 and 90),
        'd90_plus', (select coalesce(sum(bos_to_base(balance, currency, issue_date)), 0) from inv where status in ('sent','partially_paid','overdue') and current_date - due_date > 90)),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
        'invoiced', (select coalesce(sum(bos_to_base(total, currency, issue_date)), 0) from inv where status <> 'draft' and date_trunc('month', issue_date) = m),
        'collected', (select coalesce(sum(bos_to_base(amount - refunded_amount, currency, payment_date)), 0) from pay where date_trunc('month', payment_date) = m),
        'expenses', (select coalesce(sum(bos_to_base(amount, currency, expense_date)), 0) from expenses e where e.approval_status = 'approved' and date_trunc('month', e.expense_date) = m)) order by m)
      from generate_series(date_trunc('month', v_to::timestamp) - interval '11 months', date_trunc('month', v_to::timestamp), interval '1 month') m), '[]'::jsonb),
    'by_client', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('client_id', c.id, 'client', c.name,
               'collected', coalesce(sum(bos_to_base(p.amount - p.refunded_amount, p.currency, p.payment_date)), 0)) x
        from pay p join clients c on c.id = p.client_id
        where p.payment_date between v_from and v_to
        group by c.id, c.name order by 2 desc limit 20) s), '[]'::jsonb),
    'expenses', (select coalesce(sum(bos_to_base(amount, currency, expense_date)), 0) from expenses where approval_status = 'approved' and expense_date between v_from and v_to),
    'expenses_by_category', coalesce((select jsonb_agg(jsonb_build_object('category', ec.name, 'amount', t.amount)) from (
        select category_id, sum(bos_to_base(amount, currency, expense_date)) amount from expenses
        where approval_status = 'approved' and expense_date between v_from and v_to group by category_id) t
        join expense_categories ec on ec.id = t.category_id), '[]'::jsonb),
    'commissions', jsonb_build_object(
        'pending', (select coalesce(sum(bos_to_base(amount, currency)), 0) from commissions where status = 'pending'),
        'eligible', (select coalesce(sum(bos_to_base(eligible_amount, currency)), 0) from commissions where status = 'eligible'),
        'approved', (select coalesce(sum(bos_to_base(eligible_amount, currency)), 0) from commissions where status = 'approved'),
        'paid', (select coalesce(sum(bos_to_base(eligible_amount, currency, paid_at::date)), 0) from commissions where status = 'paid' and paid_at::date between v_from and v_to))
  ) into r;
  return r;
end;
$$;

create or replace function public.bos_report_bd(f jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_from date := bos_filter_from(f);
  v_to date := bos_filter_to(f);
  v_users uuid[] := bos_filter_users(f);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', e.user_id, 'name', e.full_name,
      'leads', (select count(*) from leads l where l.assigned_to = e.user_id and l.created_at::date between v_from and v_to),
      'qualified', bos_kpi_actual('leads.qualified_count', e.user_id, v_from, v_to),
      'outreach', bos_kpi_actual('activities.outreach_count', e.user_id, v_from, v_to),
      'meetings', bos_kpi_actual('meetings.count', e.user_id, v_from, v_to),
      'proposals', bos_kpi_actual('proposals.sent_count', e.user_id, v_from, v_to),
      'pipeline', (select coalesce(sum(bos_to_base(d.value, d.currency)), 0) from deals d join pipeline_stages s on s.id = d.stage_id
                   where d.assigned_to = e.user_id and s.category = 'open' and d.archived_at is null),
      'weighted_pipeline', (select coalesce(sum(bos_to_base(d.value * d.probability / 100, d.currency)), 0) from deals d join pipeline_stages s on s.id = d.stage_id
                   where d.assigned_to = e.user_id and s.category = 'open' and d.archived_at is null),
      'won', (select count(*) from deals d where d.assigned_to = e.user_id and d.won_at::date between v_from and v_to),
      'won_value', (select coalesce(sum(bos_to_base(d.value, d.currency, d.won_at::date)), 0) from deals d where d.assigned_to = e.user_id and d.won_at::date between v_from and v_to),
      'revenue', (select coalesce(sum(bos_to_base(p.amount - p.refunded_amount, p.currency, p.payment_date)), 0) from bos_payments p join deals d on d.id = p.deal_id
                  where d.assigned_to = e.user_id and p.status in ('completed','refunded') and p.payment_date between v_from and v_to),
      'commission', (select coalesce(sum(bos_to_base(c.eligible_amount, c.currency)), 0) from commissions c where c.user_id = e.user_id and c.status in ('eligible','approved','paid'))
    ) order by e.full_name)
    from employees e
    where e.user_id is not null and e.archived_at is null
      and (v_users is null or e.user_id = any(v_users))
      and exists (select 1 from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = e.user_id and r.key in ('business_development','sales_manager','account_manager'))
  ), '[]'::jsonb);
end;
$$;

create or replace function public.bos_project_financials(p_project uuid)
returns jsonb
language sql
stable
as $$
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
    from time_entries te, p where te.project_id = p.id and te.ended_at is not null
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
$$;

create or replace function public.bos_report_projects(f jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_users uuid[] := bos_filter_users(f);
begin
  return (
    with pr as (
      select p.*, bos_project_financials(p.id) fin from projects p
      where p.archived_at is null
        and (v_users is null or p.pm_id = any(v_users) or exists (select 1 from project_members pm where pm.project_id = p.id and pm.user_id = any(v_users)))
        and (f->>'client_id' is null or p.client_id = (f->>'client_id')::uuid)
    ), calc as (
      select pr.*,
        case when fin->>'revenue_basis' = 'invoiced' then (fin->>'invoiced')::numeric else (fin->>'collected')::numeric end as revenue,
        (fin->>'employee_cost')::numeric + (fin->>'freelancer_cost')::numeric + (fin->>'vendor_cost')::numeric
          + (fin->>'infrastructure_cost')::numeric + (fin->>'third_party_cost')::numeric + (fin->>'other_cost')::numeric as cost
      from pr
    )
    select jsonb_build_object(
      'active', (select count(*) from calc where status not in ('completed','cancelled','on_hold')),
      'completed', (select count(*) from calc where status = 'completed'),
      'delayed', (select count(*) from calc where health = 'delayed' and status not in ('completed','cancelled')),
      'at_risk', (select count(*) from calc where health = 'at_risk' and status not in ('completed','cancelled')),
      'on_time_rate', (select case when count(*) > 0 then round(100.0 * count(*) filter (where completed_at::date <= deadline) / count(*), 2) end
                         from calc where status = 'completed' and deadline is not null),
      'projects', coalesce((select jsonb_agg(jsonb_build_object(
          'id', id, 'name', name, 'status', status, 'health', health, 'currency', currency, 'budget', budget,
          'revenue', revenue, 'cost', cost, 'profit', revenue - cost,
          'margin', case when revenue > 0 then round(100 * (revenue - cost) / revenue, 2) end,
          'hours', (fin->>'hours')::numeric,
          'planned_hours', (select round(coalesce(sum(t.estimated_minutes), 0) / 60.0, 2) from tasks t where t.project_id = calc.id and t.archived_at is null),
          'over_budget', cost > budget and budget > 0,
          'deadline', deadline, 'progress', progress) order by name) from calc), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.bos_report_clients(f jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_from date := bos_filter_from(f);
  v_to date := bos_filter_to(f);
  v_users uuid[] := bos_filter_users(f);
begin
  return (
    with c as (
      select cl.* from clients cl
      where cl.archived_at is null and (v_users is null or cl.account_manager_id = any(v_users))
    ), first_win as (
      select d.client_id, min(d.won_at) first_won from deals d where d.won_at is not null group by d.client_id
    ), completed_clients as (
      select distinct p.client_id, min(p.completed_at) first_completed from projects p where p.status = 'completed' group by p.client_id
    )
    select jsonb_build_object(
      'new_clients', (select count(*) from first_win fw join c on c.id = fw.client_id where fw.first_won::date between v_from and v_to),
      'active_clients', (select count(*) from c where exists (select 1 from projects p where p.client_id = c.id and p.status not in ('completed','cancelled'))),
      'total_clients', (select count(*) from c where account_status = 'active'),
      'retention', (select case when count(*) > 0 then round(100.0 * count(*) filter (where exists (
                        select 1 from deals d where d.client_id = cc.client_id and d.won_at > cc.first_completed and d.won_at <= cc.first_completed + interval '12 months')) / count(*), 2) end
                    from completed_clients cc join c on c.id = cc.client_id),
      'upsells', (select count(*) from deals d join c on c.id = d.client_id where d.is_upsell and d.created_at::date between v_from and v_to),
      'clients', coalesce((select jsonb_agg(x order by (x->>'revenue')::numeric desc) from (
          select jsonb_build_object('id', c.id, 'name', c.name, 'country', c.country,
            'revenue', (select coalesce(sum(bos_to_base(p.amount - p.refunded_amount, p.currency, p.payment_date)), 0) from bos_payments p where p.client_id = c.id and p.status in ('completed','refunded')),
            'projects', (select count(*) from projects p where p.client_id = c.id),
            'active_projects', (select count(*) from projects p where p.client_id = c.id and p.status not in ('completed','cancelled')),
            'upsells', (select count(*) from deals d where d.client_id = c.id and d.is_upsell),
            'open_upsell_value', (select coalesce(sum(bos_to_base(d.value, d.currency)), 0) from deals d join pipeline_stages s on s.id = d.stage_id where d.client_id = c.id and d.is_upsell and s.category = 'open')) x
          from c) s), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.bos_report_countries(f jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_from date := bos_filter_from(f);
  v_to date := bos_filter_to(f);
  v_users uuid[] := bos_filter_users(f);
begin
  return coalesce((
    with lc as (
      select coalesce(nullif(country, ''), 'Other') country, count(*) leads,
             count(*) filter (where exists (select 1 from status_history sh where sh.entity_type = 'lead' and sh.entity_id = l.id and sh.to_status = 'qualified')) qualified
      from leads l where l.created_at::date between v_from and v_to and (v_users is null or l.assigned_to = any(v_users))
      group by 1
    ), dc as (
      select coalesce(nullif(c.country, ''), 'Other') country, count(*) deals,
             count(*) filter (where d.won_at is not null) won,
             coalesce(sum(bos_to_base(d.value, d.currency, d.won_at::date)) filter (where d.won_at is not null), 0) won_value
      from deals d join clients c on c.id = d.client_id
      where d.created_at::date between v_from and v_to and (v_users is null or d.assigned_to = any(v_users))
      group by 1
    )
    select jsonb_agg(jsonb_build_object(
      'country', coalesce(lc.country, dc.country),
      'leads', coalesce(lc.leads, 0), 'qualified', coalesce(lc.qualified, 0),
      'deals', coalesce(dc.deals, 0), 'won', coalesce(dc.won, 0), 'won_revenue', coalesce(dc.won_value, 0),
      'conversion', case when coalesce(dc.deals, 0) > 0 then round(100.0 * dc.won / dc.deals, 2) else 0 end,
      'avg_deal_value', case when coalesce(dc.won, 0) > 0 then round(dc.won_value / dc.won, 2) else 0 end
    ) order by coalesce(dc.won_value, 0) desc)
    from lc full outer join dc on dc.country = lc.country
  ), '[]'::jsonb);
end;
$$;

create or replace function public.bos_report_products(f jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_from date := bos_filter_from(f);
  v_to date := bos_filter_to(f);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'product_id', pr.id, 'name', pr.name, 'kind', pr.kind,
      'leads', (select count(*) from leads l where l.product_interest_id = pr.id and l.created_at::date between v_from and v_to),
      'deals', (select count(distinct dp.deal_id) from deal_products dp join deals d on d.id = dp.deal_id where dp.product_id = pr.id and d.created_at::date between v_from and v_to),
      'won', (select count(distinct dp.deal_id) from deal_products dp join deals d on d.id = dp.deal_id where dp.product_id = pr.id and d.won_at::date between v_from and v_to),
      'revenue', (select coalesce(sum(bos_to_base(dp.line_total, d.currency, d.won_at::date)), 0) from deal_products dp join deals d on d.id = dp.deal_id where dp.product_id = pr.id and d.won_at::date between v_from and v_to),
      'conversion', (select case when count(distinct dp.deal_id) > 0 then round(100.0 * count(distinct dp.deal_id) filter (where d.won_at is not null) / count(distinct dp.deal_id), 2) else 0 end
                     from deal_products dp join deals d on d.id = dp.deal_id where dp.product_id = pr.id and d.created_at::date between v_from and v_to),
      'avg_deal_value', (select case when count(*) > 0 then round(avg(bos_to_base(dp.line_total, d.currency, d.won_at::date)), 2) else 0 end
                         from deal_products dp join deals d on d.id = dp.deal_id where dp.product_id = pr.id and d.won_at::date between v_from and v_to),
      'profit', (select coalesce(sum(
                   case when d.value > 0 then (dp.line_total / d.value) * bos_to_base(
                     (case when (fin->>'revenue_basis') = 'invoiced' then (fin->>'invoiced')::numeric else (fin->>'collected')::numeric end)
                     - ((fin->>'employee_cost')::numeric + (fin->>'freelancer_cost')::numeric + (fin->>'vendor_cost')::numeric
                        + (fin->>'infrastructure_cost')::numeric + (fin->>'third_party_cost')::numeric + (fin->>'other_cost')::numeric),
                     p.currency) end), 0)
                 from deal_products dp join deals d on d.id = dp.deal_id join projects p on p.deal_id = d.id
                 cross join lateral bos_project_financials(p.id) fin
                 where dp.product_id = pr.id)
    ) order by pr.name)
    from products pr where pr.archived_at is null
  ), '[]'::jsonb);
end;
$$;

create or replace function public.bos_report_team(f jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_from date := bos_filter_from(f);
  v_to date := bos_filter_to(f);
  v_users uuid[] := bos_filter_users(f);
begin
  return coalesce((
    select jsonb_agg(x order by x->>'name') from (
      select jsonb_build_object(
        'user_id', e.user_id, 'name', e.full_name, 'department', d.name, 'position', e.position,
        'logged_hours', round(coalesce((select sum(te.duration_minutes) from time_entries te where te.user_id = e.user_id and te.started_at::date between v_from and v_to), 0) / 60.0, 2),
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
        and (v_users is null or e.user_id = any(v_users))
        and (f->>'department_id' is null or e.department_id = (f->>'department_id')::uuid)
    ) s
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Global search (§64). Results are permission-filtered by the service.
-- ---------------------------------------------------------------------------

create or replace function public.bos_search(p_q text, p_types text[] default null, p_limit integer default 8)
returns table (entity_type text, id uuid, title text, subtitle text, owner_id uuid, client_id uuid, project_id uuid, rank real)
language sql
stable
as $$
  with q as (select trim(p_q) as t, '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%' as pat)
  (select 'lead', l.id, l.name, coalesce(l.company_name, l.email), l.assigned_to, l.client_id, null::uuid, greatest(extensions.similarity(l.name, q.t), extensions.similarity(coalesce(l.company_name, ''), q.t))
     from leads l, q where (p_types is null or 'lead' = any(p_types)) and l.archived_at is null
       and (l.name ilike q.pat or l.company_name ilike q.pat or l.email ilike q.pat or l.lead_number ilike q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'contact', c.id, c.full_name, coalesce(c.email, c.position), c.created_by, c.client_id, null, extensions.similarity(c.full_name, q.t)
     from contacts c, q where (p_types is null or 'contact' = any(p_types)) and c.archived_at is null
       and (c.full_name ilike q.pat or c.email ilike q.pat or c.phone ilike q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'client', c.id, c.name, coalesce(c.company_name, c.email), c.account_manager_id, c.id, null, greatest(extensions.similarity(c.name, q.t), extensions.similarity(coalesce(c.company_name, ''), q.t))
     from clients c, q where (p_types is null or 'client' = any(p_types)) and c.archived_at is null
       and (c.name ilike q.pat or c.company_name ilike q.pat or c.email ilike q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'deal', d.id, d.name, d.deal_number || ' · ' || d.value || ' ' || d.currency, d.assigned_to, d.client_id, null, extensions.similarity(d.name, q.t)
     from deals d, q where (p_types is null or 'deal' = any(p_types)) and d.archived_at is null
       and (d.name ilike q.pat or d.deal_number ilike q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'project', p.id, p.name, p.project_number, p.pm_id, p.client_id, p.id, extensions.similarity(p.name, q.t)
     from projects p, q where (p_types is null or 'project' = any(p_types)) and p.archived_at is null
       and (p.name ilike q.pat or p.project_number ilike q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'task', t.id, t.title, t.status::text, t.assigned_to, t.client_id, t.project_id, extensions.similarity(t.title, q.t)
     from tasks t, q where (p_types is null or 'task' = any(p_types)) and t.archived_at is null and t.title ilike q.pat
     order by 8 desc limit p_limit)
  union all
  (select 'file', f.id, f.name, coalesce(f.entity_type, 'file'), f.uploaded_by, null, null, extensions.similarity(f.name, q.t)
     from files f, q where (p_types is null or 'file' = any(p_types)) and f.deleted_at is null and f.is_finalized and f.name ilike q.pat
     order by 8 desc limit p_limit)
  union all
  (select 'ticket', t.id, t.subject, t.ticket_number || ' · ' || t.status, t.assigned_to, t.client_id, t.project_id, extensions.similarity(t.subject, q.t)
     from tickets t, q where (p_types is null or 'ticket' = any(p_types)) and (t.subject ilike q.pat or t.ticket_number ilike q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'kb_article', a.id, a.title, a.kind::text, a.author_id, null, null, extensions.similarity(a.title, q.t)
     from kb_articles a, q where (p_types is null or 'kb_article' = any(p_types)) and a.status <> 'archived'
       and (a.title ilike q.pat or a.search @@ plainto_tsquery('simple', q.t))
     order by 8 desc limit p_limit);
$$;

create trigger automation_rules_touch before update on automation_rules for each row execute function bos_touch_updated_at();

alter table automation_rules enable row level security;
alter table automation_runs enable row level security;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

revoke execute on function
  public.bos_report_sales(jsonb), public.bos_report_revenue(jsonb), public.bos_report_bd(jsonb),
  public.bos_project_financials(uuid), public.bos_report_projects(jsonb), public.bos_report_clients(jsonb),
  public.bos_report_countries(jsonb), public.bos_report_products(jsonb), public.bos_report_team(jsonb),
  public.bos_search(text, text[], integer), public.bos_to_base(numeric, char, date), public.bos_base_currency()
from public, anon, authenticated;
