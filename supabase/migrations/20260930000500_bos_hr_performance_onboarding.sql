-- HR & Workforce — performance (goals, cycles, ratings, self assessment,
-- 360 feedback), onboarding/offboarding task fields and new checklist items,
-- HR notification subscriptions (docs/bos/28 §23–25, §35).

-- ---------------------------------------------------------------------------
-- Performance
-- ---------------------------------------------------------------------------

create table review_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cycle_type text not null default 'annual' check (cycle_type in ('annual','semi_annual','quarterly','probation','ad_hoc')),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft','active','closed')),
  self_assessment boolean not null default true,
  peer_feedback boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table performance_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  metric text,
  unit text,
  target_value numeric(14,3),
  current_value numeric(14,3),
  weight numeric(5,2) check (weight is null or weight between 0 and 100),
  start_date date,
  due_date date,
  status text not null default 'not_started' check (status in ('not_started','on_track','at_risk','off_track','completed','cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  kpi_id uuid references kpis(id) on delete set null,
  cycle_id uuid references review_cycles(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index performance_goals_user_idx on performance_goals (user_id, status);

alter table performance_reviews
  add column cycle_id uuid references review_cycles(id) on delete set null,
  add column review_type text not null default 'periodic' check (review_type in ('periodic','annual','probation','ad_hoc')),
  add column overall_rating numeric(2,1) check (overall_rating is null or overall_rating between 1 and 5),
  add column manager_rating numeric(2,1) check (manager_rating is null or manager_rating between 1 and 5),
  add column self_rating numeric(2,1) check (self_rating is null or self_rating between 1 and 5),
  add column self_assessment text,
  add column self_submitted_at timestamptz,
  add column competencies jsonb not null default '[]'::jsonb,
  add column recommendation text not null default 'none' check (recommendation in ('none','promotion','salary_increase','bonus','pip','confirm_probation','extend_probation','termination'));

alter table employee_compensation add constraint employee_compensation_review_fk foreign key (review_id) references performance_reviews(id) on delete set null;
alter table employee_job_history add constraint employee_job_history_review_fk foreign key (review_id) references performance_reviews(id) on delete set null;

create table performance_feedback (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid references review_cycles(id) on delete set null,
  review_id uuid references performance_reviews(id) on delete set null,
  relationship text not null check (relationship in ('manager','peer','direct_report','self','other')),
  rating numeric(2,1) check (rating is null or rating between 1 and 5),
  strengths text,
  improvements text,
  comments text,
  is_anonymous boolean not null default false,
  status text not null default 'requested' check (status in ('requested','submitted','declined')),
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index performance_feedback_once_idx on performance_feedback (subject_user_id, from_user_id, coalesce(cycle_id, '00000000-0000-0000-0000-000000000000'::uuid)) where status <> 'declined';

create trigger review_cycles_touch before update on review_cycles for each row execute function bos_touch_updated_at();
create trigger performance_goals_touch before update on performance_goals for each row execute function bos_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Onboarding / offboarding tasks: status, assignee, due date, notes
-- ---------------------------------------------------------------------------

alter table onboarding_items
  add column status text not null default 'pending' check (status in ('pending','in_progress','done','skipped','blocked')),
  add column assignee_user_id uuid references auth.users(id) on delete set null,
  add column due_date date,
  add column notes text;

update onboarding_items set status = 'done' where is_done;

create or replace function public.bos_onboarding_item_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_done and new.status = 'pending' then new.status := 'done'; end if;
    if new.status in ('done','skipped') then new.is_done := true; end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    new.is_done := new.status in ('done','skipped');
    if new.is_done and new.done_at is null then new.done_at := now(); end if;
    if not new.is_done then new.done_at := null; new.done_by := null; end if;
  elsif new.is_done is distinct from old.is_done then
    new.status := case when new.is_done then 'done' else 'pending' end;
  end if;
  return new;
end;
$$;
create trigger onboarding_items_sync before insert or update on onboarding_items for each row execute function bos_onboarding_item_sync();

-- New template items (appended; existing items and checklists preserved).
update checklist_templates set items = items || '[
  {"section":"Hiring & Documents","label":"Job offer signed","auto_key":"offer_signed","required":true,"responsible":"hr"},
  {"section":"Hiring & Documents","label":"Employment contract signed","auto_key":"contract_signed","required":true,"responsible":"hr"},
  {"section":"Hiring & Documents","label":"Employee data completed","auto_key":"data_completed","required":true,"responsible":"hr"},
  {"section":"Hiring & Documents","label":"ID verified","auto_key":"id_verified","required":true,"responsible":"hr"},
  {"section":"Hiring & Documents","label":"Required documents received","auto_key":"documents_received","required":true,"responsible":"hr"},
  {"section":"Hiring & Documents","label":"Payment (bank) details provided","auto_key":"payment_details","required":true,"responsible":"employee"},
  {"section":"Hiring & Documents","label":"Emergency contact provided","auto_key":"emergency_contact","required":true,"responsible":"employee"},
  {"section":"Hiring & Documents","label":"Salary and compensation set up","auto_key":"compensation_set","required":true,"responsible":"hr"},
  {"section":"Access","label":"CRM (BOS) access","auto_key":"role_assigned","required":true,"responsible":"admin"},
  {"section":"Access","label":"Google/Office access","auto_key":"app_category:Productivity","required":true,"responsible":"admin"},
  {"section":"Access","label":"Communication tools access","auto_key":"app_category:Communication","required":true,"responsible":"admin"},
  {"section":"Access","label":"Sales tools access (if applicable)","auto_key":"app_category:Prospecting","required":false,"responsible":"admin"},
  {"section":"Training","label":"Orientation session","auto_key":null,"required":true,"responsible":"hr"}
]'::jsonb
where key = 'employee_onboarding' and not items @> '[{"auto_key":"offer_signed"}]'::jsonb;

update checklist_templates set name = 'Employee offboarding', items = items || '[
  {"section":"Equipment","label":"Return company assets (cards, keys, documents)","auto_key":null,"required":true,"responsible":"admin"},
  {"section":"Settlement","label":"Final salary settlement","auto_key":"final_salary","required":true,"responsible":"finance"},
  {"section":"Settlement","label":"Pending expenses settled","auto_key":"expenses_settled","required":true,"responsible":"finance"},
  {"section":"Settlement","label":"Loans and advances settled","auto_key":"loans_settled","required":true,"responsible":"finance"},
  {"section":"Documents","label":"Documents issued (experience letter, clearance)","auto_key":null,"required":true,"responsible":"hr"},
  {"section":"Completion","label":"Exit interview","auto_key":"exit_interview","required":true,"responsible":"hr"},
  {"section":"Completion","label":"Final approval","auto_key":"confirm:final","required":true,"responsible":"hr"}
]'::jsonb
where key = 'employee_offboarding' and not items @> '[{"auto_key":"final_salary"}]'::jsonb;

-- Add the new items to checklists that are still in progress.
insert into onboarding_items (checklist_id, section, label, auto_key, responsible, required, sort_order)
select c.id, i->>'section', i->>'label', nullif(i->>'auto_key', ''), i->>'responsible', coalesce((i->>'required')::boolean, true), ord
from onboarding_checklists c
join checklist_templates t on t.key = c.template_key
cross join lateral jsonb_array_elements(t.items) with ordinality as x(i, ord)
where c.status = 'in_progress' and c.template_key in ('employee_onboarding','employee_offboarding')
  and not exists (select 1 from onboarding_items oi where oi.checklist_id = c.id and oi.label = i->>'label');

-- ---------------------------------------------------------------------------
-- Notification subscriptions for HR events (§35), configurable in Settings
-- ---------------------------------------------------------------------------

insert into notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
select * from (values
  ('overtime.requested', 'relation', 'manager_of_assignee', array['in_app'], true),
  ('loan.decided', 'relation', 'employee', array['in_app','email'], true),
  ('bonus.decided', 'relation', 'employee', array['in_app'], true),
  ('bonus.decided', 'relation', 'creator', array['in_app'], true),
  ('hr_request.decided', 'relation', 'employee', array['in_app','email'], true),
  ('hr_request.completed', 'relation', 'employee', array['in_app','email'], true),
  ('employee_expense.decided', 'relation', 'employee', array['in_app'], true),
  ('employee_expense.reimbursed', 'relation', 'employee', array['in_app'], true),
  ('employee_contract.expiring', 'relation', 'manager_of_assignee', array['in_app'], true),
  ('employee_document.expiring', 'relation', 'employee', array['in_app','email'], true),
  ('employee_document.rejected', 'relation', 'employee', array['in_app'], true),
  ('onboarding.task_assigned', 'relation', 'assignee', array['in_app','email'], true),
  ('offboarding.task_assigned', 'relation', 'assignee', array['in_app','email'], true),
  ('payslip.published', 'relation', 'employee', array['in_app','email'], true),
  ('interview.scheduled', 'relation', 'assignee', array['in_app','email'], true),
  ('interview.feedback_requested', 'relation', 'assignee', array['in_app'], true),
  ('candidate.stage_changed', 'relation', 'assignee', array['in_app'], true),
  ('job_offer.accepted', 'relation', 'assignee', array['in_app','email'], true),
  ('job_offer.rejected', 'relation', 'assignee', array['in_app'], true),
  ('performance.feedback_requested', 'relation', 'assignee', array['in_app','email'], true),
  ('performance.goal_assigned', 'relation', 'employee', array['in_app'], true),
  ('compensation.changed', 'relation', 'employee', array['in_app'], true)
) as v(event_type, subscriber_kind, relation, channels, user_configurable)
where not exists (select 1 from notification_subscriptions s where s.event_type = v.event_type and s.relation = v.relation);

insert into notification_subscriptions (event_type, subscriber_kind, role_id, channels, user_configurable)
select v.event_type, 'role', r.id, v.channels, true
from (values
  ('employee_contract.expiring', 'hr', array['in_app','email']),
  ('employee_document.expiring', 'hr', array['in_app']),
  ('employee_document.uploaded', 'hr', array['in_app']),
  ('offboarding.started', 'hr', array['in_app']),
  ('offboarding.started', 'admin', array['in_app']),
  ('payroll.approved', 'hr', array['in_app']),
  ('payroll.paid', 'hr', array['in_app']),
  ('payroll.paid', 'finance', array['in_app']),
  ('employee_expense.approved', 'finance', array['in_app']),
  ('job_offer.accepted', 'hr', array['in_app','email']),
  ('job_offer.rejected', 'hr', array['in_app']),
  ('candidate.hired', 'hr', array['in_app']),
  ('candidate.hired', 'admin', array['in_app']),
  ('career.application_received', 'hr', array['in_app'])
) as v(event_type, role_key, channels)
join roles r on r.key = v.role_key
where not exists (select 1 from notification_subscriptions s where s.event_type = v.event_type and s.role_id = r.id);

alter table review_cycles enable row level security;
alter table performance_goals enable row level security;
alter table performance_feedback enable row level security;

grant all on all tables in schema public to service_role;
