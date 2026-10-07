-- Final product spec, phase 1 (part 2): database functions, policies and
-- triggers that belonged to the removed modules are dropped; functions that
-- touched them are rewritten without them. Reports sum one currency (EGP or
-- USD, chosen by the report filter) — there is no currency conversion.

-- ───────────── Triggers & policies of removed modules ─────────────
drop trigger if exists employees_infer_branch on public.employees;
drop trigger if exists leads_infer_branch on public.leads;
drop trigger if exists clients_infer_branch on public.clients;
drop trigger if exists deals_infer_branch on public.deals;
drop trigger if exists bos_invoices_infer_branch on public.bos_invoices;
drop trigger if exists bos_payments_infer_branch on public.bos_payments;
drop trigger if exists expenses_infer_branch on public.expenses;
drop trigger if exists tickets_infer_branch on public.tickets;
drop trigger if exists devices_infer_branch on public.devices;
drop trigger if exists career_jobs_infer_branch on public.career_jobs;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and policyname like 'portal reads %' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ───────────── Functions of removed modules ─────────────
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname in (
      'bos_infer_branch', 'bos_head_office', 'bos_user_branch', 'bos_branch_ok', 'bos_branch_ok_deal',
      'bos_fx_rate', 'bos_to_base', 'bos_base_currency',
      'bos_time_entry_compute', 'bos_time_entry_task_actual', 'bos_tasks_progress_trigger',
      'bos_recompute_project_progress', 'bos_recompute_project_health', 'bos_recompute_all_project_health',
      'bos_pick_pm', 'bos_apply_change_request', 'bos_project_completion_blockers', 'bos_project_financials',
      'bos_report_products', 'bos_report_projects', 'bos_generate_access_checklist', 'bos_whatsapp_click',
      'portal_client_id', 'portal_owns_entity',
      -- signatures change below
      'bos_start_onboarding', 'bos_search')
  loop
    execute format('drop function %s cascade', r.fn);
  end loop;
end $$;

-- ───────────── Data of removed modules ─────────────
-- Maintenance plans belonged to project delivery and the client portal.
drop table if exists public.support_plans cascade;
alter table public.bos_payments drop column if exists exchange_rate;
-- Distance was measured to the employee's branch.
alter table public.employee_locations drop column if exists distance_to_branch_m;
delete from public.schedule_assignments where scope = 'branch';
alter table public.schedule_assignments drop constraint if exists schedule_assignments_scope_check;
alter table public.schedule_assignments add constraint schedule_assignments_scope_check
  check (scope in ('company', 'department', 'team', 'employee'));

delete from public.kpis where data_source in (
  'projects.on_time_ratio', 'milestones.completion_ratio', 'tasks.completion_ratio', 'tasks.completed_count',
  'projects.budget_variance', 'projects.satisfaction_avg', 'issues.open_count', 'time.logged_hours');

update public.checklist_templates t
   set items = coalesce((select jsonb_agg(i order by ord) from jsonb_array_elements(t.items) with ordinality x(i, ord)
                         where coalesce(i->>'auto_key', '') not in ('project_created', 'project_started', 'required_access_active', 'access_revoked', 'accounts_suspended')
                           and coalesce(i->>'auto_key', '') not like 'app_category:%'
                           and not (t.key = 'client_onboarding' and i->>'auto_key' = 'team_assigned')), '[]'::jsonb);
delete from public.onboarding_items
 where auto_key in ('project_created', 'project_started', 'required_access_active', 'access_revoked', 'accounts_suspended')
    or auto_key like 'app_category:%'
    or (auto_key = 'team_assigned' and checklist_id in (select id from public.onboarding_checklists where subject = 'client'));

delete from public.notification_subscriptions where relation in ('pm', 'project_members');
delete from public.notification_subscriptions
 where event_type ~ '^(project|milestone|change_request|access|social|automation|time|portal|issue|camera|whatsapp|branch)\.';
delete from public.activity_events
 where event_type ~ '^(project|milestone|change_request|access|social|automation|time|portal|issue|camera|whatsapp|branch)\.'
    or entity_type in ('project', 'task', 'milestone', 'change_request', 'issue', 'time_entry', 'product', 'camera', 'social_post', 'branch');
delete from public.notification_templates
 where event_type ~ '^(project|milestone|change_request|access|social|automation|time|portal|issue|camera|whatsapp|branch)\.';

-- ───────────── Enum values & checks of removed modules ─────────────
update public.tickets set source = 'email' where source = 'portal';
alter table public.tickets drop constraint if exists tickets_source_check;
alter table public.tickets add constraint tickets_source_check check (source in ('email', 'internal'));

delete from public.manual_notifications where target_kind = 'branch';
alter table public.manual_notifications drop constraint if exists manual_notifications_target_kind_check;
alter table public.manual_notifications add constraint manual_notifications_target_kind_check
  check (target_kind in ('users', 'team', 'department', 'role', 'all'));

delete from public.approvals where approval_type in ('change_request', 'final_delivery', 'access_request', 'milestone');
alter table public.approvals alter column approval_type type text;
drop type public.approval_type;
create type public.approval_type as enum ('proposal', 'contract', 'design', 'scope', 'invoice', 'leave', 'expense', 'attendance_correction',
  'overtime', 'payroll', 'loan', 'bonus', 'hr_request', 'job_offer', 'salary_adjustment');
alter table public.approvals alter column approval_type type public.approval_type using approval_type::public.approval_type;

update public.payment_schedules set trigger = 'on_date' where trigger in ('on_milestone', 'on_completion');
alter table public.payment_schedules alter column trigger drop default, alter column trigger type text;
drop type public.schedule_trigger;
create type public.schedule_trigger as enum ('on_signing', 'on_date');
alter table public.payment_schedules alter column trigger type public.schedule_trigger using trigger::public.schedule_trigger,
  alter column trigger set default 'on_date';
update public.deals d set payment_terms = (select jsonb_agg(case when t->>'trigger' in ('on_milestone', 'on_completion') then jsonb_set(t, '{trigger}', '"on_date"') else t end)
                                            from jsonb_array_elements(d.payment_terms) t)
 where exists (select 1 from jsonb_array_elements(d.payment_terms) t where t->>'trigger' in ('on_milestone', 'on_completion'));

update public.commission_rules set trigger = 'payment_collected' where trigger = 'milestone_payment';
alter table public.commission_rules alter column trigger drop default, alter column trigger type text;
drop type public.commission_trigger;
create type public.commission_trigger as enum ('deal_won', 'contract_signed', 'payment_collected', 'full_payment');
alter table public.commission_rules alter column trigger type public.commission_trigger using trigger::public.commission_trigger,
  alter column trigger set default 'payment_collected';

update public.clients set crm_stage = 'invoice' where crm_stage = 'project';
alter table public.clients alter column crm_stage drop default, alter column crm_stage type text;
drop type public.crm_stage;
create type public.crm_stage as enum ('lead', 'qualified', 'call_booked', 'call_completed', 'proposal_requested', 'proposal_sent',
  'proposal_viewed', 'proposal_accepted', 'proposal_rejected', 'contract', 'invoice');
alter table public.clients alter column crm_stage type public.crm_stage using crm_stage::public.crm_stage,
  alter column crm_stage set default 'lead';

delete from public.channels where kind = 'project';
alter table public.channels alter column kind type text;
drop type public.channel_kind;
create type public.channel_kind as enum ('direct', 'team', 'entity');
alter table public.channels alter column kind type public.channel_kind using kind::public.channel_kind;

drop type if exists public.access_status, public.change_request_status, public.milestone_status, public.product_kind,
  public.project_health, public.project_status, public.task_status;

update public.bos_settings set value = value - 'access_request' - 'access_request_sensitive' where key = 'approval_policies';
update public.bos_settings set value = value - 'profitability_revenue_basis' where key = 'finance';
update public.bos_settings set value = value - 'whatsapp' where key = 'integrations';

-- Project documents (maintenance agreement, licence, handover certificate).
delete from public.generated_documents where entity_type = 'project';
delete from public.document_templates where doc_type in ('maintenance_agreement', 'license_certificate', 'handover_certificate');
alter table public.document_templates drop constraint if exists document_templates_doc_type_check;
alter table public.document_templates add constraint document_templates_doc_type_check
  check (doc_type in ('proposal', 'client_contract', 'invoice', 'email', 'job_offer', 'employment_contract', 'nda_ip', 'hr_document', 'report'));

-- ───────────── Rewritten functions ─────────────
CREATE OR REPLACE FUNCTION public.bos_start_onboarding(p_subject text, p_template_key text, p_client uuid, p_deal uuid, p_employee uuid, p_due date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_id uuid;
begin
  if p_subject = 'client' then
    select id into v_id from onboarding_checklists where deal_id = p_deal;
  else
    select id into v_id from onboarding_checklists
     where employee_id = p_employee and subject = 'employee' and template_key = p_template_key and status <> 'cancelled';
  end if;
  if v_id is not null then
    return v_id;
  end if;

  insert into onboarding_checklists (subject, template_key, client_id, deal_id, employee_id, due_date)
  values (p_subject, p_template_key, p_client, p_deal, p_employee, p_due)
  returning id into v_id;

  insert into onboarding_items (checklist_id, section, label, auto_key, responsible, required, sort_order)
  select v_id, i->>'section', i->>'label', nullif(i->>'auto_key', ''), i->>'responsible',
         coalesce((i->>'required')::boolean, true), ord
  from checklist_templates t, jsonb_array_elements(t.items) with ordinality as x(i, ord)
  where t.key = p_template_key;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_search(p_q text, p_types text[] DEFAULT NULL::text[], p_limit integer DEFAULT 8)
 RETURNS TABLE(entity_type text, id uuid, title text, subtitle text, owner_id uuid, client_id uuid, rank real)
 LANGUAGE sql
 STABLE
AS $function$
  with q as (select trim(p_q) as t, '%' || bos_norm(replace(replace(trim(p_q), '%', ''), '_', '')) || '%' as pat)
  (select 'lead', l.id, l.name, coalesce(l.company_name, l.email), l.assigned_to, l.client_id, greatest(extensions.similarity(l.name, q.t), extensions.similarity(coalesce(l.company_name, ''), q.t))
     from leads l, q where (p_types is null or 'lead' = any(p_types)) and l.archived_at is null
       and (bos_norm(l.name) like q.pat or bos_norm(l.company_name) like q.pat or lower(l.email) like q.pat or lower(l.lead_number) like q.pat)
     order by 7 desc limit p_limit)
  union all
  (select 'contact', c.id, c.full_name, coalesce(c.email, c.position), c.created_by, c.client_id, extensions.similarity(c.full_name, q.t)
     from contacts c, q where (p_types is null or 'contact' = any(p_types)) and c.archived_at is null
       and (bos_norm(c.full_name) like q.pat or lower(c.email) like q.pat or c.phone like q.pat)
     order by 7 desc limit p_limit)
  union all
  (select 'client', c.id, c.name, coalesce(c.company_name, c.email), c.account_manager_id, c.id, greatest(extensions.similarity(c.name, q.t), extensions.similarity(coalesce(c.company_name, ''), q.t))
     from clients c, q where (p_types is null or 'client' = any(p_types)) and c.archived_at is null
       and (bos_norm(c.name) like q.pat or bos_norm(c.company_name) like q.pat or lower(c.email) like q.pat)
     order by 7 desc limit p_limit)
  union all
  (select 'deal', d.id, d.name, d.deal_number || ' · ' || d.value || ' ' || d.currency, d.assigned_to, d.client_id, extensions.similarity(d.name, q.t)
     from deals d, q where (p_types is null or 'deal' = any(p_types)) and d.archived_at is null
       and (bos_norm(d.name) like q.pat or lower(d.deal_number) like q.pat)
     order by 7 desc limit p_limit)
  union all
  (select 'file', f.id, f.name, coalesce(f.entity_type, 'file'), f.uploaded_by, null, extensions.similarity(f.name, q.t)
     from files f, q where (p_types is null or 'file' = any(p_types)) and f.deleted_at is null and f.is_finalized and bos_norm(f.name) like q.pat
     order by 7 desc limit p_limit)
  union all
  (select 'ticket', t.id, t.subject, t.ticket_number || ' · ' || t.status, t.assigned_to, t.client_id, extensions.similarity(t.subject, q.t)
     from tickets t, q where (p_types is null or 'ticket' = any(p_types)) and (bos_norm(t.subject) like q.pat or lower(t.ticket_number) like q.pat)
     order by 7 desc limit p_limit)
  union all
  (select 'kb_article', a.id, a.title, a.kind::text, a.author_id, null, extensions.similarity(a.title, q.t)
     from kb_articles a, q where (p_types is null or 'kb_article' = any(p_types)) and a.status <> 'archived'
       and (bos_norm(a.title) like q.pat or a.search @@ plainto_tsquery('simple', q.t))
     order by 7 desc limit p_limit)
  union all
  -- Phase 17 additions
  (select 'employee', e.id, e.full_name, coalesce(e.position, e.email), e.user_id, null, extensions.similarity(e.full_name, q.t)
     from employees e, q where (p_types is null or 'employee' = any(p_types)) and e.archived_at is null
       and (bos_norm(e.full_name) like q.pat or lower(e.email) like q.pat or lower(e.employee_code) like q.pat or bos_norm(e.position) like q.pat)
     order by 7 desc limit p_limit)
  union all
  (select 'invoice', i.id, i.invoice_number, i.status::text || ' · ' || i.total || ' ' || i.currency, i.created_by, i.client_id, extensions.similarity(i.invoice_number, q.t)
     from bos_invoices i, q where (p_types is null or 'invoice' = any(p_types)) and lower(i.invoice_number) like q.pat
     order by 7 desc limit p_limit)
  union all
  (select 'expense', x.id, x.description, x.amount || ' ' || x.currency || ' · ' || x.expense_date, coalesce(x.employee_user_id, x.created_by), x.client_id, extensions.similarity(x.description, q.t)
     from expenses x, q where (p_types is null or 'expense' = any(p_types)) and x.archived_at is null and bos_norm(x.description) like q.pat
     order by 7 desc limit p_limit)
  union all
  (select 'meeting', m.id, m.title, to_char(m.start_at, 'YYYY-MM-DD HH24:MI'), m.organizer_id, m.client_id, extensions.similarity(m.title, q.t)
     from meetings m, q where (p_types is null or 'meeting' = any(p_types)) and bos_norm(m.title) like q.pat
     order by 7 desc limit p_limit)
  union all
  (select 'document', g.id, g.title, g.number || ' · ' || g.status, g.created_by, null, extensions.similarity(g.title, q.t)
     from generated_documents g, q where (p_types is null or 'document' = any(p_types)) and g.status <> 'void'
       and (bos_norm(g.title) like q.pat or lower(g.number) like q.pat or lower(coalesce(g.reference, '')) like q.pat)
     order by 7 desc limit p_limit)
  union all
  (select 'conversation', v.id, coalesce(v.subject, v.number), v.number || ' · ' || v.status || ' · ' || coalesce(sc.name, ''), v.assignee_id, v.client_id, extensions.similarity(coalesce(v.subject, ''), q.t)
     from bos_conversations v join support_customers sc on sc.id = v.customer_id, q where (p_types is null or 'conversation' = any(p_types))
       and (bos_norm(v.subject) like q.pat or lower(v.number) like q.pat or bos_norm(sc.name) like q.pat or lower(coalesce(sc.email, '')) like q.pat)
     order by 7 desc limit p_limit);
$function$
;

CREATE OR REPLACE FUNCTION public.bos_round_money(p_amount numeric, p_currency character)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select round(p_amount, 2);
$function$
;

CREATE OR REPLACE FUNCTION public.bos_create_invoice_from_schedule(p_schedule_id uuid, p_actor uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_s payment_schedules%rowtype;
  v_fin jsonb := coalesce((select value from bos_settings where key = 'finance'), '{}'::jsonb);
  v_deal deals%rowtype;
  v_invoice uuid;
  v_status invoice_status;
begin
  select * into v_s from payment_schedules where id = p_schedule_id for update;
  if v_s.id is null then
    raise exception 'Schedule row not found' using errcode = 'P0002';
  end if;
  if v_s.invoice_id is not null then
    return v_s.invoice_id;
  end if;
  select * into v_deal from deals where id = v_s.deal_id;

  v_status := case when coalesce((v_fin->>'auto_send_first_invoice')::boolean, false) then 'sent' else 'draft' end;

  insert into bos_invoices (client_id, deal_id, schedule_id, currency, issue_date, due_date, status, payment_terms, sent_at, created_by)
  values (v_s.client_id, v_s.deal_id, v_s.id, v_s.currency, current_date,
          greatest(current_date, coalesce(v_s.due_date, current_date)) + coalesce((v_fin->>'default_payment_due_days')::int, 7),
          v_status, v_s.label || ' (' || v_s.percent || '%)', case when v_status = 'sent' then now() end, p_actor)
  on conflict (schedule_id) do nothing
  returning id into v_invoice;

  if v_invoice is null then
    select id into v_invoice from bos_invoices where schedule_id = p_schedule_id;
    return v_invoice;
  end if;

  insert into invoice_items (invoice_id, description, quantity, unit_price, sort_order)
  values (v_invoice, v_deal.name || ' — ' || v_s.label || ' (' || v_s.percent || '%)', 1, v_s.amount, 1);

  update payment_schedules set invoice_id = v_invoice, status = 'invoiced' where id = v_s.id;

  perform bos_status('invoice', v_invoice, null, v_status::text, p_actor, 'Generated from payment schedule');
  perform bos_audit(p_actor, 'invoice.created', 'invoice', v_invoice, null,
    jsonb_build_object('amount', v_s.amount, 'currency', v_s.currency, 'schedule_id', v_s.id), null,
    jsonb_build_object('automation', 'payment_schedule'), 'automation');
  perform bos_emit('invoice.created', 'invoice', v_invoice, p_actor,
    'Invoice created: ' || v_s.amount || ' ' || v_s.currency || ' (' || v_s.label || ')',
    jsonb_build_object('invoice_id', v_invoice, 'amount', v_s.amount, 'currency', v_s.currency, 'deal_id', v_s.deal_id, 'client_id', v_s.client_id),
    jsonb_build_array(jsonb_build_object('type','client','id',v_s.client_id), jsonb_build_object('type','deal','id',v_s.deal_id)),
    'automation', 'internal', 'invoice.created:' || v_invoice);

  return v_invoice;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_evaluate_commissions(p_deal_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_deal deals%rowtype;
  v_rule commission_rules%rowtype;
  v_base numeric;
  v_amount numeric;
  v_currency char(3);
  v_commission_id uuid;
begin
  select * into v_deal from deals where id = p_deal_id;
  if v_deal.id is null or v_deal.assigned_to is null then
    return;
  end if;

  select r.* into v_rule
  from commission_rules r
  where r.is_active
    and (r.valid_from is null or r.valid_from <= current_date)
    and (r.valid_to is null or r.valid_to >= current_date)
    and (r.user_id is null or r.user_id = v_deal.assigned_to)
    and (r.role_id is null or exists (select 1 from user_roles ur where ur.user_id = v_deal.assigned_to and ur.role_id = r.role_id))
  order by (case when r.user_id is not null then 4 else 0 end
          + case when r.role_id is not null then 1 else 0 end) desc,
           r.priority desc, r.created_at
  limit 1;

  if v_rule.id is null then
    return;
  end if;

  v_base := v_deal.value;

  if v_rule.basis = 'percentage' then
    v_currency := v_deal.currency;
    v_amount := bos_round_money(v_base * v_rule.rate / 100, v_currency);
  else
    v_currency := v_rule.currency;
    v_amount := v_rule.fixed_amount;
  end if;

  if v_rule.min_amount is not null then v_amount := greatest(v_amount, v_rule.min_amount); end if;
  if v_rule.max_amount is not null then v_amount := least(v_amount, v_rule.max_amount); end if;

  insert into commissions (deal_id, user_id, rule_id, base_amount, currency, amount)
  values (v_deal.id, v_deal.assigned_to, v_rule.id, v_base, v_currency, v_amount)
  on conflict (deal_id, user_id, rule_id) do update
    set base_amount = excluded.base_amount, amount = excluded.amount, currency = excluded.currency
    where commissions.status in ('pending','eligible')
  returning id into v_commission_id;

  if v_commission_id is not null then
    perform bos_emit('commission.created', 'commission', v_commission_id, p_actor,
      'Commission calculated: ' || v_amount || ' ' || v_currency,
      jsonb_build_object('deal_id', v_deal.id, 'user_id', v_deal.assigned_to, 'amount', v_amount, 'currency', v_currency, 'employee_user_id', v_deal.assigned_to),
      jsonb_build_array(jsonb_build_object('type','deal','id',v_deal.id)),
      'automation', 'internal', 'commission.created:' || v_commission_id);
  end if;

  perform bos_update_commission_eligibility(p_deal_id, p_actor);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_process_deal_won(p_deal_id uuid, p_actor uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_deal deals%rowtype;
  v_sales jsonb := coalesce((select value from bos_settings where key = 'sales'), '{}'::jsonb);
  v_fin jsonb := coalesce((select value from bos_settings where key = 'finance'), '{}'::jsonb);
  v_won_stage uuid;
  v_old_stage_key text;
  v_lead_won_stage uuid;
  v_contract contracts%rowtype;
  v_start date;
  v_term jsonb;
  v_terms_count integer;
  v_percent_sum numeric;
  v_allocated numeric := 0;
  v_amount numeric;
  v_i integer := 0;
  v_schedule_id uuid;
  v_invoice uuid;
  v_first_schedule uuid;
  v_checklist uuid;
  v_links jsonb;
begin
  select * into v_deal from deals where id = p_deal_id for update;
  if v_deal.id is null then
    raise exception 'Deal not found' using errcode = 'P0002';
  end if;

  if v_deal.won_processed_at is not null then
    return p_deal_id;
  end if;

  if v_deal.lost_at is not null then
    raise exception 'A lost deal cannot be marked as won' using errcode = '22023';
  end if;
  if v_deal.archived_at is not null then
    raise exception 'An archived deal cannot be marked as won' using errcode = '22023';
  end if;

  v_terms_count := jsonb_array_length(v_deal.payment_terms);
  select coalesce(sum((t->>'percent')::numeric), 0) into v_percent_sum from jsonb_array_elements(v_deal.payment_terms) t;

  if coalesce((v_sales->>'require_payment_terms_for_won')::boolean, true) and (v_terms_count = 0 or v_percent_sum <> 100) then
    raise exception 'Payment terms must be defined and total 100%% before the deal can be won' using errcode = '22023';
  end if;
  if v_terms_count > 0 and v_percent_sum <> 100 then
    raise exception 'Payment terms must total 100%% (currently %)', v_percent_sum using errcode = '22023';
  end if;

  if coalesce((v_sales->>'require_signed_contract_for_won')::boolean, false)
     and not exists (select 1 from contracts where deal_id = p_deal_id and status = 'signed') then
    raise exception 'A signed contract is required before the deal can be won' using errcode = '22023';
  end if;

  -- 1. Deal → Won
  select id into v_won_stage from pipeline_stages
   where pipeline_id = v_deal.pipeline_id and category = 'won' and is_active order by sort_order limit 1;
  select key into v_old_stage_key from pipeline_stages where id = v_deal.stage_id;

  update deals set stage_id = v_won_stage, won_at = coalesce(won_at, now()), probability = 100
   where id = p_deal_id;
  perform bos_status('deal', p_deal_id, v_old_stage_key, 'won', p_actor, null);
  perform bos_audit(p_actor, 'deal.won', 'deal', p_deal_id,
    jsonb_build_object('stage', v_old_stage_key), jsonb_build_object('stage', 'won', 'value', v_deal.value, 'currency', v_deal.currency));

  v_links := jsonb_build_array(jsonb_build_object('type','client','id',v_deal.client_id),
                               jsonb_build_object('type','lead','id',v_deal.lead_id),
                               jsonb_build_object('type','contact','id',v_deal.contact_id));

  perform bos_emit('deal.won', 'deal', p_deal_id, p_actor, 'Deal won: ' || v_deal.name || ' (' || v_deal.value || ' ' || v_deal.currency || ')',
    jsonb_build_object('deal_id', p_deal_id, 'value', v_deal.value, 'currency', v_deal.currency,
                       'owner_user_id', v_deal.assigned_to, 'client_id', v_deal.client_id, 'has_payment_terms', v_terms_count > 0,
                       'is_upsell', v_deal.is_upsell),
    v_links, 'user', 'internal', 'deal.won:' || p_deal_id);

  -- 2. Account & contact (never create a duplicate account: the deal already references one)
  update clients set account_status = 'active' where id = v_deal.client_id and account_status <> 'active';
  if v_deal.contact_id is not null then
    update contacts set client_id = v_deal.client_id where id = v_deal.contact_id and client_id is null;
    update clients set primary_contact_id = coalesce(primary_contact_id, v_deal.contact_id) where id = v_deal.client_id;
  end if;

  if v_deal.lead_id is not null then
    select s.id into v_lead_won_stage from pipeline_stages s join pipelines p on p.id = s.pipeline_id
     where p.entity = 'lead' and p.is_default and s.category = 'won' order by s.sort_order limit 1;
    update leads set client_id = coalesce(client_id, v_deal.client_id),
                     contact_id = coalesce(contact_id, v_deal.contact_id),
                     converted_deal_id = coalesce(converted_deal_id, p_deal_id),
                     converted_at = coalesce(converted_at, now()),
                     stage_id = coalesce(v_lead_won_stage, stage_id)
     where id = v_deal.lead_id;
  end if;

  -- 3. Contract (latest signed, else latest non-cancelled)
  select * into v_contract from contracts
   where deal_id = p_deal_id and status <> 'cancelled'
   order by (status = 'signed') desc, created_at desc limit 1;

  v_start := coalesce(v_contract.start_date, current_date);

  -- 4. Payment schedule from deal payment terms (last row absorbs rounding ⇒ Σ = deal value exactly)
  for v_term in select * from jsonb_array_elements(v_deal.payment_terms) loop
    v_i := v_i + 1;
    if v_i = v_terms_count then
      v_amount := v_deal.value - v_allocated;
    else
      v_amount := bos_round_money(v_deal.value * (v_term->>'percent')::numeric / 100, v_deal.currency);
    end if;
    v_allocated := v_allocated + v_amount;

    insert into payment_schedules (deal_id, client_id, label, percent, amount, currency, due_date, trigger, sort_order)
    values (p_deal_id, v_deal.client_id,
            coalesce(nullif(v_term->>'label', ''), 'Installment ' || v_i),
            (v_term->>'percent')::numeric, v_amount, v_deal.currency,
            v_start + coalesce(nullif(v_term->>'due_offset_days', '')::int, 0),
            coalesce(nullif(v_term->>'trigger', ''), case when v_i = 1 then 'on_signing' else 'on_date' end)::schedule_trigger,
            v_i)
    on conflict (deal_id, sort_order) do nothing
    returning id into v_schedule_id;

    if v_i = 1 then v_first_schedule := v_schedule_id; end if;
  end loop;

  -- 5. First invoice(s): every on_signing installment (unique schedule_id ⇒ no duplicates)
  for v_schedule_id in
    select id from payment_schedules
     where deal_id = p_deal_id and invoice_id is null and status = 'scheduled'
       and (trigger = 'on_signing' or (id = v_first_schedule and not exists (
             select 1 from payment_schedules ps2 where ps2.deal_id = p_deal_id and ps2.trigger = 'on_signing')))
     order by sort_order
  loop
    v_invoice := bos_create_invoice_from_schedule(v_schedule_id, p_actor);
  end loop;

  -- 6. Commission
  perform bos_evaluate_commissions(p_deal_id, p_actor);

  -- 7. Client onboarding
  v_checklist := bos_start_onboarding('client', 'client_onboarding', v_deal.client_id, p_deal_id, null, v_start + 7);
  if v_contract.status = 'signed' then
    perform bos_complete_onboarding_item(v_checklist, 'contract_signed', p_actor);
  end if;
  if exists (select 1 from bos_payments where deal_id = p_deal_id and status = 'completed') then
    perform bos_complete_onboarding_item(v_checklist, 'initial_payment', p_actor);
  end if;

  perform bos_emit('onboarding.started', 'client', v_deal.client_id, p_actor, 'Client onboarding started',
    jsonb_build_object('checklist_id', v_checklist, 'deal_id', p_deal_id),
    jsonb_build_array(jsonb_build_object('type','deal','id',p_deal_id)),
    'automation', 'internal', 'onboarding.started:' || v_checklist);

  update deals set won_processed_at = now() where id = p_deal_id;
  return p_deal_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_record_payment(p jsonb, p_actor uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_existing uuid;
  v_inv bos_invoices%rowtype;
  v_deal deals%rowtype;
  v_amount numeric := (p->>'amount')::numeric;
  v_currency char(3) := upper(p->>'currency');
  v_invoice_amount numeric;
  v_deal_amount numeric;
  v_status payment_status := coalesce(nullif(p->>'status', ''), 'completed')::payment_status;
  v_allow_over boolean := coalesce((select (value->>'allow_overpayment')::boolean from bos_settings where key = 'finance'), false);
  v_client uuid := (p->>'client_id')::uuid;
  v_id uuid;
begin
  if nullif(p->>'idempotency_key', '') is not null then
    select id into v_existing from bos_payments where idempotency_key = p->>'idempotency_key';
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'Payment amount must be greater than zero' using errcode = '22023';
  end if;

  if nullif(p->>'invoice_id', '') is not null then
    select * into v_inv from bos_invoices where id = (p->>'invoice_id')::uuid for update;
    if v_inv.id is null then
      raise exception 'Invoice not found' using errcode = 'P0002';
    end if;
    if v_inv.status = 'cancelled' then
      raise exception 'Cannot record a payment against a cancelled invoice' using errcode = '22023';
    end if;
    if v_client is null then v_client := v_inv.client_id; end if;
    if v_inv.client_id <> v_client then
      raise exception 'Invoice belongs to a different client' using errcode = '22023';
    end if;

    -- One currency per invoice; no conversion (EGP or USD, spec §54).
    if v_currency <> v_inv.currency then
      raise exception 'Payment currency must match the invoice currency (%)', v_inv.currency using errcode = '22023';
    end if;
    v_invoice_amount := v_amount;

    if not v_allow_over and v_status in ('completed','processing','pending') and v_invoice_amount > v_inv.balance then
      raise exception 'Payment exceeds the invoice outstanding balance (%)', v_inv.balance using errcode = '22023';
    end if;

    if v_inv.status = 'draft' then
      update bos_invoices set status = 'sent', sent_at = coalesce(sent_at, now()) where id = v_inv.id;
      perform bos_status('invoice', v_inv.id, 'draft', 'sent', p_actor, 'Payment recorded');
    end if;
  end if;

  if coalesce(nullif(p->>'deal_id', '')::uuid, v_inv.deal_id) is not null then
    select * into v_deal from deals where id = coalesce(nullif(p->>'deal_id', '')::uuid, v_inv.deal_id);
    if v_deal.currency <> v_currency then
      raise exception 'Payment currency must match the deal currency (%)', v_deal.currency using errcode = '22023';
    end if;
    v_deal_amount := v_amount;
  end if;

  insert into bos_payments (client_id, invoice_id, deal_id, amount, currency, invoice_amount, deal_amount,
                        method, payment_date, reference, status, notes, idempotency_key, created_by)
  values (v_client, v_inv.id, v_deal.id, v_amount, v_currency, v_invoice_amount, v_deal_amount,
          coalesce(nullif(p->>'method', ''), 'bank_transfer')::payment_method,
          coalesce((p->>'payment_date')::date, current_date), nullif(p->>'reference', ''), v_status,
          nullif(p->>'notes', ''), nullif(p->>'idempotency_key', ''), p_actor)
  returning id into v_id;

  perform bos_status('payment', v_id, null, v_status::text, p_actor, null);
  perform bos_audit(p_actor, 'payment.created', 'payment', v_id, null,
    jsonb_build_object('amount', v_amount, 'currency', v_currency, 'invoice_id', v_inv.id, 'status', v_status, 'reference', p->>'reference'));
  perform bos_emit('payment.created', 'payment', v_id, p_actor,
    'Payment of ' || v_amount || ' ' || v_currency || ' recorded',
    jsonb_build_object('amount', v_amount, 'currency', v_currency, 'invoice_id', v_inv.id, 'deal_id', v_deal.id, 'client_id', v_client),
    jsonb_build_array(jsonb_build_object('type','client','id',v_client), jsonb_build_object('type','invoice','id',v_inv.id),
                      jsonb_build_object('type','deal','id',v_deal.id)));

  if v_status = 'completed' then
    perform bos_apply_payment_completed(v_id, p_actor);
  end if;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_clock_out(p_user uuid, p_source text DEFAULT 'web'::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.bos_detect_open_sessions()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.bos_day_off_reason(p_employee uuid, p_date date)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select case
    when exists (select 1 from holidays h, employees e where e.id = p_employee and h.date = p_date
                   and (h.country is null or h.country = e.country)) then 'holiday'
    when exists (select 1 from employee_days_off o, employees e where e.id = p_employee and o.date = p_date and (
            (o.scope = 'employee' and o.employee_id = e.id) or
            (o.scope = 'team' and o.team_id = e.team_id) or
            (o.scope = 'department' and o.department_id = e.department_id))) then 'custom'
    else null
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_resolve_schedule_id(p_employee uuid, p_date date)
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.bos_pick_user_for_role(p_role_key text, p_kind text DEFAULT 'tasks'::text)
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select e.user_id
  from employees e
  join user_roles ur on ur.user_id = e.user_id
  join roles r on r.id = ur.role_id and r.key = p_role_key
  where e.user_id is not null and e.lifecycle_status in ('active','onboarding') and e.archived_at is null
  order by
    case p_kind
      when 'leads' then (select count(*) from leads l where l.assigned_to = e.user_id and l.archived_at is null)
      else (select count(*) from tickets t where t.assigned_to = e.user_id and t.status not in ('resolved','closed'))
    end,
    e.created_at
  limit 1;
$function$
;

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
              and type in ('call','email','linkedin') and coalesce(direction, 'outbound') = 'outbound'
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
    when 'attendance.on_time_ratio' then
      select count(*) filter (where status in ('present','overtime','remote')), count(*) filter (where status in ('present','late','overtime','remote','half_day'))
        into v_num, v_den from attendance_records where user_id = p_user and work_date between p_start and p_end;
      return case when v_den > 0 then round(100 * v_num / v_den, 2) else null end;
    else
      return null;
  end case;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_mark_overdue_work(p_today date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  v_t record;
  v_n integer := 0;
begin
  for v_t in
    select * from activities
    where archived_at is null and due_at is not null and due_at < now()
      and status in ('pending','in_progress','overdue')
  loop
    if v_t.status <> 'overdue' then
      update activities set status = 'overdue' where id = v_t.id;
    end if;
    if bos_emit('task.overdue', 'activity', v_t.id, null, 'Follow-up overdue: ' || v_t.title,
        jsonb_build_object('activity_id', v_t.id, 'title', v_t.title, 'assignee_user_id', v_t.assigned_to, 'due_at', v_t.due_at,
                           'overdue_days', p_today - (v_t.due_at at time zone 'UTC')::date, 'kind', 'follow_up'),
        jsonb_build_array(jsonb_build_object('type','lead','id',v_t.lead_id), jsonb_build_object('type','deal','id',v_t.deal_id),
                          jsonb_build_object('type','client','id',v_t.client_id)),
        'system', 'internal', 'activity.overdue:' || v_t.id || ':' || p_today) is not null then
      v_n := v_n + 1;
    end if;
  end loop;

  return v_n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_sync_lead_activity_dates()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_lead uuid := coalesce(new.lead_id, old.lead_id);
begin
  if v_lead is null then
    return null;
  end if;

  update leads l set
    last_activity_at = (
      select max(coalesce(a.completed_at, a.created_at)) from activities a
      where a.lead_id = v_lead and a.archived_at is null
        and (a.status = 'completed' or a.type in ('note','email','call','linkedin','client_communication'))
    ),
    next_activity_at = (
      select min(coalesce(a.due_at, a.start_at)) from activities a
      where a.lead_id = v_lead and a.archived_at is null
        and a.status in ('pending','in_progress','overdue')
        and coalesce(a.due_at, a.start_at) is not null
    )
  where l.id = v_lead;

  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.has_proposal_access(target_proposal_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from proposal_access pa
    where pa.proposal_id = target_proposal_id and pa.auth_user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.bos_report_revenue(f jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  -- One currency per report, never converted (EGP or USD, spec §54).
  v_cur text := case when f->>'currency' = 'EGP' then 'EGP' else 'USD' end;
  v_from date := bos_filter_from(f);
  v_to date := bos_filter_to(f);
  v_client uuid := nullif(f->>'client_id', '')::uuid;
  r jsonb;
begin
  with inv as (
    select i.* from bos_invoices i
    where i.status <> 'cancelled'
      and (v_client is null or i.client_id = v_client)
  ), pay as (
    select p.* from bos_payments p
    where p.status in ('completed','refunded')
      and (v_client is null or p.client_id = v_client)
  )
  select jsonb_build_object(
    'from', v_from, 'to', v_to, 'currency', v_cur,
    'revenue', (select coalesce(sum((case when currency = v_cur then total else 0 end)), 0) from inv where status <> 'draft' and issue_date between v_from and v_to),
    'collected', (select coalesce(sum((case when currency = v_cur then amount - refunded_amount else 0 end)), 0) from pay where payment_date between v_from and v_to),
    'outstanding', (select coalesce(sum((case when currency = v_cur then balance else 0 end)), 0) from inv where status in ('sent','partially_paid','overdue')),
    'overdue', (select coalesce(sum((case when currency = v_cur then balance else 0 end)), 0) from inv where status in ('sent','partially_paid','overdue') and due_date < current_date),
    'by_currency', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'invoiced', invoiced, 'outstanding', outstanding)) from (
        select currency, sum(total) filter (where issue_date between v_from and v_to and status <> 'draft') invoiced,
               sum(balance) filter (where status in ('sent','partially_paid','overdue')) outstanding
        from inv group by currency) c), '[]'::jsonb),
    'aging', jsonb_build_object(
        'd0_30', (select coalesce(sum((case when currency = v_cur then balance else 0 end)), 0) from inv where status in ('sent','partially_paid','overdue') and current_date - due_date between 1 and 30),
        'd31_60', (select coalesce(sum((case when currency = v_cur then balance else 0 end)), 0) from inv where status in ('sent','partially_paid','overdue') and current_date - due_date between 31 and 60),
        'd61_90', (select coalesce(sum((case when currency = v_cur then balance else 0 end)), 0) from inv where status in ('sent','partially_paid','overdue') and current_date - due_date between 61 and 90),
        'd90_plus', (select coalesce(sum((case when currency = v_cur then balance else 0 end)), 0) from inv where status in ('sent','partially_paid','overdue') and current_date - due_date > 90)),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
        'invoiced', (select coalesce(sum((case when currency = v_cur then total else 0 end)), 0) from inv where status <> 'draft' and date_trunc('month', issue_date) = m),
        'collected', (select coalesce(sum((case when currency = v_cur then amount - refunded_amount else 0 end)), 0) from pay where date_trunc('month', payment_date) = m),
        'expenses', (select coalesce(sum((case when currency = v_cur then amount else 0 end)), 0) from expenses e where e.approval_status = 'approved' and date_trunc('month', e.expense_date) = m)) order by m)
      from generate_series(date_trunc('month', v_to::timestamp) - interval '11 months', date_trunc('month', v_to::timestamp), interval '1 month') m), '[]'::jsonb),
    'by_client', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('client_id', c.id, 'client', c.name,
               'collected', coalesce(sum((case when p.currency = v_cur then p.amount - p.refunded_amount else 0 end)), 0)) x
        from pay p join clients c on c.id = p.client_id
        where p.payment_date between v_from and v_to
        group by c.id, c.name order by coalesce(sum((case when p.currency = v_cur then p.amount - p.refunded_amount else 0 end)), 0) desc limit 20) s), '[]'::jsonb),
    'expenses', (select coalesce(sum((case when currency = v_cur then amount else 0 end)), 0) from expenses where approval_status = 'approved' and expense_date between v_from and v_to),
    'expenses_by_category', coalesce((select jsonb_agg(jsonb_build_object('category', ec.name, 'amount', t.amount)) from (
        select category_id, sum((case when currency = v_cur then amount else 0 end)) amount from expenses
        where approval_status = 'approved' and expense_date between v_from and v_to group by category_id) t
        join expense_categories ec on ec.id = t.category_id), '[]'::jsonb),
    'commissions', jsonb_build_object(
        'pending', (select coalesce(sum((case when currency = v_cur then amount else 0 end)), 0) from commissions where status = 'pending'),
        'eligible', (select coalesce(sum((case when currency = v_cur then eligible_amount else 0 end)), 0) from commissions where status = 'eligible'),
        'approved', (select coalesce(sum((case when currency = v_cur then eligible_amount else 0 end)), 0) from commissions where status = 'approved'),
        'paid', (select coalesce(sum((case when currency = v_cur then eligible_amount else 0 end)), 0) from commissions where status = 'paid' and paid_at::date between v_from and v_to))
  ) into r;
  return r;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_report_sales(f jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  -- One currency per report, never converted (EGP or USD, spec §54).
  v_cur text := case when f->>'currency' = 'EGP' then 'EGP' else 'USD' end;
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
  ), d as (
    select d.*, c.country as client_country from deals d join clients c on c.id = d.client_id
    where (v_users is null or d.assigned_to = any(v_users))
      and (f->>'country' is null or c.country = f->>'country')
      and (f->>'source_id' is null or d.source_id = (f->>'source_id')::uuid)
      and (f->>'client_id' is null or d.client_id = (f->>'client_id')::uuid)
  ), qualified as (
    select count(distinct sh.entity_id) n from status_history sh join l on l.id = sh.entity_id
    where sh.entity_type = 'lead' and sh.to_status = 'qualified' and sh.changed_at >= v_tf and sh.changed_at < v_tt
  ), won as (
    select count(*) n, coalesce(sum((case when currency = v_cur then value else 0 end)), 0) v
    from d where won_at >= v_tf and won_at < v_tt
  ), lost as (
    select count(*) n from d where lost_at >= v_tf and lost_at < v_tt
  ), created_deals as (
    select count(*) n from d where created_at >= v_tf and created_at < v_tt
  )
  select jsonb_build_object(
    'from', v_from, 'to', v_to, 'currency', v_cur,
    'leads', (select count(*) from l where created_at >= v_tf and created_at < v_tt),
    'qualified', (select n from qualified),
    'meetings', (select count(*) from meetings m where m.start_at >= v_tf and m.start_at < v_tt and m.status = 'completed'
                   and (v_users is null or m.organizer_id = any(v_users))),
    'proposals', (select count(*) from proposals p where p.sent_at >= v_tf and p.sent_at < v_tt and (v_users is null or p.owner_id = any(v_users))),
    'won', (select n from won),
    'lost', (select n from lost),
    'revenue', (select v from won),
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
        'revenue', (select coalesce(sum((case when currency = v_cur then value else 0 end)), 0) from d where date_trunc('month', d.won_at) = m)) order by m)
      from generate_series(date_trunc('month', v_to::timestamp) - interval '11 months', date_trunc('month', v_to::timestamp), interval '1 month') m), '[]'::jsonb)
  ) into r;
  return r;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_report_bd(f jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  -- One currency per report, never converted (EGP or USD, spec §54).
  v_cur text := case when f->>'currency' = 'EGP' then 'EGP' else 'USD' end;
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
      'pipeline', (select coalesce(sum((case when d.currency = v_cur then d.value else 0 end)), 0) from deals d join pipeline_stages s on s.id = d.stage_id
                   where d.assigned_to = e.user_id and s.category = 'open' and d.archived_at is null),
      'weighted_pipeline', (select coalesce(sum((case when d.currency = v_cur then d.value * d.probability / 100 else 0 end)), 0) from deals d join pipeline_stages s on s.id = d.stage_id
                   where d.assigned_to = e.user_id and s.category = 'open' and d.archived_at is null),
      'won', (select count(*) from deals d where d.assigned_to = e.user_id and d.won_at::date between v_from and v_to),
      'won_value', (select coalesce(sum((case when d.currency = v_cur then d.value else 0 end)), 0) from deals d where d.assigned_to = e.user_id and d.won_at::date between v_from and v_to),
      'revenue', (select coalesce(sum((case when p.currency = v_cur then p.amount - p.refunded_amount else 0 end)), 0) from bos_payments p join deals d on d.id = p.deal_id
                  where d.assigned_to = e.user_id and p.status in ('completed','refunded') and p.payment_date between v_from and v_to),
      'commission', (select coalesce(sum((case when c.currency = v_cur then c.eligible_amount else 0 end)), 0) from commissions c where c.user_id = e.user_id and c.status in ('eligible','approved','paid'))
    ) order by e.full_name)
    from employees e
    where e.user_id is not null and e.archived_at is null
      and (v_users is null or e.user_id = any(v_users))
     
      and exists (select 1 from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = e.user_id and r.key in ('business_development','sales_manager','account_manager'))
  ), '[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_report_clients(f jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  -- One currency per report, never converted (EGP or USD, spec §54).
  v_cur text := case when f->>'currency' = 'EGP' then 'EGP' else 'USD' end;
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
    )
    select jsonb_build_object(
      'new_clients', (select count(*) from first_win fw join c on c.id = fw.client_id where fw.first_won::date between v_from and v_to),
      'active_clients', (select count(*) from c where exists (select 1 from deals d where d.client_id = c.id and d.won_at is not null and d.won_at::date between v_from and v_to)),
      'total_clients', (select count(*) from c where account_status = 'active'),
      'retention', (select case when count(*) > 0 then round(100.0 * count(*) filter (where exists (
                        select 1 from deals d where d.client_id = fw.client_id and d.won_at > fw.first_won and d.won_at <= fw.first_won + interval '12 months')) / count(*), 2) end
                    from first_win fw join c on c.id = fw.client_id),
      'upsells', (select count(*) from deals d join c on c.id = d.client_id where d.is_upsell and d.created_at::date between v_from and v_to),
      'clients', coalesce((select jsonb_agg(x order by (x->>'revenue')::numeric desc) from (
          select jsonb_build_object('id', c.id, 'name', c.name, 'country', c.country,
            'revenue', (select coalesce(sum((case when p.currency = v_cur then p.amount - p.refunded_amount else 0 end)), 0) from bos_payments p where p.client_id = c.id and p.status in ('completed','refunded')),
            'upsells', (select count(*) from deals d where d.client_id = c.id and d.is_upsell),
            'open_upsell_value', (select coalesce(sum((case when d.currency = v_cur then d.value else 0 end)), 0) from deals d join pipeline_stages s on s.id = d.stage_id where d.client_id = c.id and d.is_upsell and s.category = 'open')) x
          from c) s), '[]'::jsonb)
    )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_report_countries(f jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  -- One currency per report, never converted (EGP or USD, spec §54).
  v_cur text := case when f->>'currency' = 'EGP' then 'EGP' else 'USD' end;
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
             coalesce(sum((case when d.currency = v_cur then d.value else 0 end)) filter (where d.won_at is not null), 0) won_value
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
$function$
;

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
        'worked_hours', round(coalesce((select sum(ar.worked_minutes) from attendance_records ar where ar.user_id = e.user_id and ar.work_date between v_from and v_to), 0) / 60.0, 2),
        'capacity_hours', round(coalesce((
            select sum(case when extract(dow from g)::smallint = any(ws.work_days)
                            then extract(epoch from (ws.end_time - ws.start_time)) / 3600 - ws.break_minutes / 60.0 else 0 end)
            from generate_series(v_from, v_to, interval '1 day') g, bos_employee_schedule(e.user_id) ws), 0), 2),
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
$function$
;

CREATE OR REPLACE FUNCTION public.bos_apply_payment_completed(p_payment_id uuid, p_actor uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_pay bos_payments%rowtype;
begin
  select * into v_pay from bos_payments where id = p_payment_id;
  if v_pay.invoice_id is not null then
    perform bos_recalc_invoice(v_pay.invoice_id, p_actor);
  end if;
  if v_pay.deal_id is not null then
    perform bos_recalc_deal_payments(v_pay.deal_id, p_actor);
  end if;

  perform bos_emit('payment.completed', 'payment', v_pay.id, p_actor,
    'Payment received: ' || v_pay.amount || ' ' || v_pay.currency,
    jsonb_build_object('amount', v_pay.amount, 'currency', v_pay.currency, 'invoice_id', v_pay.invoice_id, 'deal_id', v_pay.deal_id,
                       'client_id', v_pay.client_id),
    jsonb_build_array(jsonb_build_object('type','client','id',v_pay.client_id), jsonb_build_object('type','invoice','id',v_pay.invoice_id),
                      jsonb_build_object('type','deal','id',v_pay.deal_id)),
    'user', 'client', 'payment.completed:' || v_pay.id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_check_sla_breaches()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  v_t record;
  v_n integer := 0;
begin
  for v_t in
    select * from tickets
    where sla_breached_at is null and status not in ('resolved','closed')
      and ((first_responded_at is null and first_response_due_at < now()) or resolution_due_at < now())
    for update skip locked
  loop
    update tickets set sla_breached_at = now() where id = v_t.id;
    perform bos_emit('ticket.sla_breached', 'ticket', v_t.id, null, 'SLA breached: ' || v_t.ticket_number || ' ' || v_t.subject,
      jsonb_build_object('ticket_id', v_t.id, 'assignee_user_id', v_t.assigned_to, 'client_id', v_t.client_id, 'priority', v_t.priority),
      jsonb_build_array(jsonb_build_object('type','client','id',v_t.client_id)),
      'system', 'internal', 'ticket.sla_breached:' || v_t.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_complete_onboarding_item(p_checklist uuid, p_auto_key text, p_actor uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
declare
  v_cl onboarding_checklists%rowtype;
begin
  update onboarding_items set is_done = true, done_by = p_actor, done_at = now()
   where checklist_id = p_checklist and auto_key = p_auto_key and not is_done;

  select * into v_cl from onboarding_checklists where id = p_checklist;
  if v_cl.status = 'in_progress' and v_cl.subject = 'client' and not exists (
    select 1 from onboarding_items where checklist_id = p_checklist and required and not is_done
  ) then
    update onboarding_checklists set status = 'completed', completed_at = now() where id = p_checklist;
    perform bos_emit('onboarding.completed', 'client', v_cl.client_id, p_actor, 'Client onboarding completed',
      jsonb_build_object('checklist_id', p_checklist, 'deal_id', v_cl.deal_id),
      jsonb_build_array(jsonb_build_object('type','deal','id',v_cl.deal_id)),
      'system', 'internal', 'onboarding.completed:' || p_checklist);
    return true;
  end if;
  return false;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_mark_overdue_invoices()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  v_inv record;
  v_count integer := 0;
begin
  for v_inv in
    select * from bos_invoices
    where status in ('sent','partially_paid') and due_date < current_date and balance > 0
    for update skip locked
  loop
    update bos_invoices set status = 'overdue', overdue_notified_at = now() where id = v_inv.id;
    perform bos_status('invoice', v_inv.id, v_inv.status::text, 'overdue', null, 'Past due date');
    perform bos_emit('invoice.overdue', 'invoice', v_inv.id, null,
      'Invoice ' || v_inv.invoice_number || ' is overdue (' || v_inv.balance || ' ' || v_inv.currency || ')',
      jsonb_build_object('invoice_id', v_inv.id, 'client_id', v_inv.client_id, 'deal_id', v_inv.deal_id, 'balance', v_inv.balance, 'currency', v_inv.currency, 'due_date', v_inv.due_date),
      jsonb_build_array(jsonb_build_object('type','client','id',v_inv.client_id), jsonb_build_object('type','deal','id',v_inv.deal_id)),
      'system', 'internal', 'invoice.overdue:' || v_inv.id || ':' || v_inv.due_date);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_recalc_invoice(p_invoice_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_inv bos_invoices%rowtype;
  v_paid numeric;
  v_refunded numeric;
  v_new invoice_status;
begin
  select * into v_inv from bos_invoices where id = p_invoice_id for update;
  if v_inv.id is null then return; end if;

  select coalesce(sum(invoice_amount), 0),
         coalesce(sum(invoice_amount * refunded_amount / amount), 0)
    into v_paid, v_refunded
    from bos_payments
   where invoice_id = p_invoice_id and status in ('completed','refunded');

  v_refunded := bos_round_money(v_refunded, v_inv.currency);

  if v_inv.status = 'cancelled' then
    v_new := 'cancelled';
  elsif v_inv.total > 0 and v_paid - v_refunded >= v_inv.total then
    v_new := 'paid';
  elsif v_paid - v_refunded > 0 then
    v_new := case when v_inv.due_date < current_date then 'overdue' else 'partially_paid' end;
  elsif v_inv.status in ('paid','partially_paid') then
    v_new := case when v_inv.due_date < current_date then 'overdue' else 'sent' end;
  else
    v_new := v_inv.status;
  end if;

  update bos_invoices
     set amount_paid = v_paid,
         amount_refunded = v_refunded,
         status = v_new,
         paid_at = case when v_new = 'paid' then coalesce(paid_at, now()) else null end,
         updated_at = now()
   where id = p_invoice_id;

  if v_new is distinct from v_inv.status then
    perform bos_status('invoice', p_invoice_id, v_inv.status::text, v_new::text, p_actor, 'Payment update');
    if v_new = 'paid' then
      perform bos_emit('invoice.paid', 'invoice', p_invoice_id, p_actor, 'Invoice ' || v_inv.invoice_number || ' paid',
        jsonb_build_object('invoice_id', p_invoice_id, 'client_id', v_inv.client_id, 'deal_id', v_inv.deal_id, 'total', v_inv.total, 'currency', v_inv.currency),
        jsonb_build_array(jsonb_build_object('type','client','id',v_inv.client_id), jsonb_build_object('type','deal','id',v_inv.deal_id)),
        'system');
    end if;
  end if;

  if v_inv.schedule_id is not null then
    update payment_schedules
       set status = case when v_new = 'paid' then 'paid'::schedule_status
                         when v_new = 'cancelled' then 'scheduled'::schedule_status
                         else 'invoiced'::schedule_status end
     where id = v_inv.schedule_id and status <> 'cancelled';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bos_update_commission_eligibility(p_deal_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_deal deals%rowtype;
  v_c record;
  v_collected numeric;
  v_ratio numeric;
  v_ok boolean;
  v_eligible numeric;
begin
  select * into v_deal from deals where id = p_deal_id;
  if v_deal.id is null then return; end if;

  v_collected := coalesce((
    select sum(coalesce(p.deal_amount, 0) * (p.amount - p.refunded_amount) / p.amount)
    from bos_payments p where p.deal_id = p_deal_id and p.status in ('completed','refunded')
  ), 0);
  v_ratio := case when v_deal.value > 0 then least(1, v_collected / v_deal.value) else 0 end;

  for v_c in
    select c.*, r.trigger as rule_trigger
    from commissions c left join commission_rules r on r.id = c.rule_id
    where c.deal_id = p_deal_id and c.status in ('pending','eligible','approved','paid')
  loop
    if v_deal.lost_at is not null then
      if v_c.status in ('pending','eligible') then
        update commissions set status = 'cancelled', updated_at = now() where id = v_c.id;
        perform bos_status('commission', v_c.id, v_c.status::text, 'cancelled', p_actor, 'Deal lost');
      end if;
      continue;
    end if;

    v_ok := false;
    v_eligible := 0;
    case coalesce(v_c.rule_trigger, 'deal_won')
      when 'deal_won' then
        v_ok := v_deal.won_at is not null; v_eligible := v_c.amount;
      when 'contract_signed' then
        v_ok := exists (select 1 from contracts ct where ct.deal_id = p_deal_id and ct.status = 'signed'); v_eligible := v_c.amount;
      when 'payment_collected' then
        v_ok := v_collected > 0; v_eligible := bos_round_money(v_c.amount * v_ratio, v_c.currency);
      when 'full_payment' then
        v_ok := v_deal.payment_status = 'paid'; v_eligible := v_c.amount;
    end case;

    if v_c.status in ('approved','paid') then
      if v_eligible < v_c.eligible_amount then
        perform bos_emit('commission.adjustment_required', 'commission', v_c.id, p_actor,
          'Commission already ' || v_c.status || ' but eligible amount dropped to ' || v_eligible,
          jsonb_build_object('deal_id', p_deal_id, 'previous', v_c.eligible_amount, 'current', v_eligible),
          jsonb_build_array(jsonb_build_object('type','deal','id',p_deal_id)), 'system', 'internal',
          'commission.adjustment_required:' || v_c.id || ':' || v_eligible);
      end if;
      continue;
    end if;

    if v_ok and v_eligible > 0 then
      update commissions
         set status = 'eligible', eligible_amount = v_eligible,
             eligible_at = coalesce(eligible_at, now()), updated_at = now()
       where id = v_c.id and (status <> 'eligible' or eligible_amount <> v_eligible);
      if v_c.status = 'pending' then
        perform bos_status('commission', v_c.id, 'pending', 'eligible', p_actor, 'Trigger satisfied: ' || coalesce(v_c.rule_trigger::text, 'deal_won'));
        perform bos_emit('commission.eligible', 'commission', v_c.id, p_actor,
          'Commission eligible: ' || v_eligible || ' ' || v_c.currency,
          jsonb_build_object('deal_id', p_deal_id, 'amount', v_eligible, 'currency', v_c.currency, 'employee_user_id', v_c.user_id),
          jsonb_build_array(jsonb_build_object('type','deal','id',p_deal_id)), 'automation', 'internal',
          'commission.eligible:' || v_c.id);
      end if;
    elsif v_c.status = 'eligible' then
      update commissions set status = 'pending', eligible_amount = 0, updated_at = now() where id = v_c.id;
      perform bos_status('commission', v_c.id, 'eligible', 'pending', p_actor, 'Trigger no longer satisfied');
    end if;
  end loop;
end;
$function$
;
