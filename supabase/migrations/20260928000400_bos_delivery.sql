-- Taysonsta BOS — Phase 4: delivery.
-- Projects, milestones, tasks, change requests, issues, time tracking,
-- onboarding checklists and the Deal Won lifecycle function.
-- See docs/bos/10-projects.md, 06-sales.md (Deal Won), 11-clients.md,
-- 27-it-access-lifecycle.md (employee onboarding template).

create type project_status as enum ('planning','design','development','qa','client_review','launch','completed','on_hold','cancelled');
create type project_health as enum ('healthy','at_risk','delayed');
create type milestone_status as enum ('not_started','in_progress','blocked','completed');
create type task_status as enum ('pending','in_progress','blocked','completed','cancelled','overdue');
create type change_request_status as enum ('requested','assessment','proposal','client_approval','approved','added_to_project','rejected');

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------

create table project_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  product_id uuid references products(id) on delete set null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  milestones jsonb not null default '[]'::jsonb check (jsonb_typeof(milestones) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index project_templates_default_idx on project_templates (is_default) where is_default;

insert into project_templates (name, is_default, milestones) values (
  'Standard delivery', true,
  '[
    {"name":"Planning","offset_days":0,"duration_days":5,"requires_client_approval":false,"tasks":[
      {"title":"Kickoff meeting with client","estimated_minutes":60,"role_key":"project_manager","required":true},
      {"title":"Confirm scope and requirements","estimated_minutes":240,"role_key":"project_manager","required":true},
      {"title":"Collect client assets","estimated_minutes":120,"role_key":"project_manager","required":true}
    ]},
    {"name":"Design","offset_days":5,"duration_days":10,"requires_client_approval":true,"tasks":[
      {"title":"Wireframes","estimated_minutes":960,"role_key":"designer","required":true},
      {"title":"UI design","estimated_minutes":1920,"role_key":"designer","required":true},
      {"title":"Design review with client","estimated_minutes":60,"role_key":"project_manager","required":true}
    ]},
    {"name":"Development","offset_days":15,"duration_days":20,"requires_client_approval":false,"tasks":[
      {"title":"Technical setup","estimated_minutes":480,"role_key":"developer","required":true},
      {"title":"Build features","estimated_minutes":4800,"role_key":"developer","required":true},
      {"title":"Integrations","estimated_minutes":960,"role_key":"developer","required":false}
    ]},
    {"name":"QA","offset_days":35,"duration_days":5,"requires_client_approval":false,"tasks":[
      {"title":"Test plan and execution","estimated_minutes":960,"role_key":"qa","required":true},
      {"title":"Fix QA issues","estimated_minutes":960,"role_key":"developer","required":true}
    ]},
    {"name":"Client Review","offset_days":40,"duration_days":5,"requires_client_approval":true,"tasks":[
      {"title":"Client review session","estimated_minutes":90,"role_key":"project_manager","required":true}
    ]},
    {"name":"Launch","offset_days":45,"duration_days":3,"requires_client_approval":true,"tasks":[
      {"title":"Production launch","estimated_minutes":240,"role_key":"developer","required":true},
      {"title":"Handover and training","estimated_minutes":120,"role_key":"project_manager","required":true}
    ]}
  ]'::jsonb
);

create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  subject text not null check (subject in ('client','employee')),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  updated_at timestamptz not null default now()
);

insert into checklist_templates (key, name, subject, items) values
('client_onboarding', 'Client onboarding', 'client', '[
  {"section":"Onboarding","label":"Contract signed","auto_key":"contract_signed","required":true},
  {"section":"Onboarding","label":"Initial payment received","auto_key":"initial_payment","required":true},
  {"section":"Onboarding","label":"Client information collected","auto_key":null,"required":true},
  {"section":"Onboarding","label":"Project created","auto_key":"project_created","required":true},
  {"section":"Onboarding","label":"Team assigned","auto_key":"team_assigned","required":true},
  {"section":"Onboarding","label":"Kickoff meeting scheduled","auto_key":"kickoff_scheduled","required":true},
  {"section":"Onboarding","label":"Assets requested","auto_key":null,"required":true},
  {"section":"Onboarding","label":"Scope confirmed","auto_key":null,"required":true},
  {"section":"Onboarding","label":"Project starts","auto_key":"project_started","required":true}
]'::jsonb),
('employee_onboarding', 'Employee onboarding', 'employee', '[
  {"section":"Account Setup","label":"Create company email","auto_key":"company_email","required":true,"responsible":"admin"},
  {"section":"Account Setup","label":"Create BOS account","auto_key":"bos_account","required":true,"responsible":"admin"},
  {"section":"Account Setup","label":"Assign role","auto_key":"role_assigned","required":true,"responsible":"admin"},
  {"section":"Account Setup","label":"Assign manager","auto_key":"manager_assigned","required":true,"responsible":"hr"},
  {"section":"Account Setup","label":"Assign team","auto_key":"team_assigned","required":true,"responsible":"hr"},
  {"section":"Account Setup","label":"Configure 2FA","auto_key":"mfa_enabled","required":true,"responsible":"employee"},
  {"section":"Account Setup","label":"Configure calendar","auto_key":null,"required":true,"responsible":"employee"},
  {"section":"Access","label":"Grant required BOS permissions","auto_key":"role_assigned","required":true,"responsible":"admin"},
  {"section":"Access","label":"Grant required external tools","auto_key":"required_access_active","required":true,"responsible":"admin"},
  {"section":"Access","label":"Add employee to required communication channels","auto_key":"channels_joined","required":true,"responsible":"admin"},
  {"section":"Access","label":"Add employee to required project/team spaces","auto_key":null,"required":false,"responsible":"manager"},
  {"section":"Equipment","label":"Assign laptop/device","auto_key":"device_assigned","required":true,"responsible":"admin"},
  {"section":"Equipment","label":"Assign required equipment","auto_key":null,"required":false,"responsible":"admin"},
  {"section":"Equipment","label":"Record asset information","auto_key":"device_assigned","required":true,"responsible":"admin"},
  {"section":"Equipment","label":"Confirm employee received equipment","auto_key":"device_received","required":true,"responsible":"employee"},
  {"section":"Knowledge","label":"Read company introduction","auto_key":"read:company-introduction","required":true,"responsible":"employee"},
  {"section":"Knowledge","label":"Read company policies","auto_key":"read:company-policies","required":true,"responsible":"employee"},
  {"section":"Knowledge","label":"Read role responsibilities","auto_key":null,"required":true,"responsible":"employee"},
  {"section":"Knowledge","label":"Read relevant SOPs","auto_key":null,"required":true,"responsible":"employee"},
  {"section":"Knowledge","label":"Read security guidelines","auto_key":"read:security-guidelines","required":true,"responsible":"employee"},
  {"section":"Knowledge","label":"Read communication guidelines","auto_key":"read:communication-guidelines","required":true,"responsible":"employee"},
  {"section":"Training","label":"Complete onboarding training","auto_key":null,"required":true,"responsible":"employee"},
  {"section":"Training","label":"Complete role-specific training","auto_key":null,"required":true,"responsible":"employee"},
  {"section":"Training","label":"Complete tool training where required","auto_key":null,"required":false,"responsible":"employee"},
  {"section":"Management","label":"First meeting with manager","auto_key":"manager_meeting","required":true,"responsible":"manager"},
  {"section":"Management","label":"Define initial responsibilities","auto_key":null,"required":true,"responsible":"manager"},
  {"section":"Management","label":"Define first objectives","auto_key":null,"required":true,"responsible":"manager"},
  {"section":"Management","label":"Define KPIs","auto_key":"kpis_assigned","required":true,"responsible":"manager"},
  {"section":"Management","label":"Confirm probation/review period if applicable","auto_key":null,"required":false,"responsible":"hr"},
  {"section":"Completion","label":"Employee confirms onboarding completion","auto_key":"confirm:employee","required":true,"responsible":"employee"},
  {"section":"Completion","label":"Manager confirms onboarding completion","auto_key":"confirm:manager","required":true,"responsible":"manager"},
  {"section":"Completion","label":"Admin confirms account/access completion","auto_key":"confirm:admin","required":true,"responsible":"admin"}
]'::jsonb);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table projects (
  id uuid primary key default gen_random_uuid(),
  project_number text not null unique default bos_next_number('project'),
  name text not null check (length(trim(name)) > 0),
  client_id uuid not null references clients(id) on delete restrict,
  primary_contact_id uuid references contacts(id) on delete set null,
  deal_id uuid unique references deals(id) on delete restrict,
  contract_id uuid references contracts(id) on delete set null,
  template_id uuid references project_templates(id) on delete set null,
  pm_id uuid references auth.users(id) on delete set null,
  status project_status not null default 'planning',
  previous_status project_status,
  health project_health not null default 'healthy',
  health_reason text,
  progress smallint not null default 0 check (progress between 0 and 100),
  budget numeric(14,3) not null default 0 check (budget >= 0),
  currency char(3) not null references currencies(code),
  scope text,
  start_date date,
  deadline date,
  completed_at timestamptz,
  support_until date,
  satisfaction_score smallint check (satisfaction_score between 1 and 10),
  satisfaction_comment text,
  cancelled_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (deadline is null or start_date is null or deadline >= start_date)
);
create index projects_client_idx on projects (client_id);
create index projects_pm_idx on projects (pm_id, status);
create index projects_status_idx on projects (status);
create index projects_deadline_idx on projects (deadline);
create index projects_name_trgm_idx on projects using gin (name extensions.gin_trgm_ops);

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_label text,
  allocation_percent smallint check (allocation_percent between 0 and 100),
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on project_members (user_id);

-- Late foreign keys to tables created in earlier migrations.
alter table deals add constraint deals_previous_project_fk foreign key (previous_project_id) references projects(id) on delete set null;
alter table activities add constraint activities_project_fk foreign key (project_id) references projects(id) on delete cascade;
alter table meetings add constraint meetings_project_fk foreign key (project_id) references projects(id) on delete set null;
alter table contracts add constraint contracts_project_fk foreign key (project_id) references projects(id) on delete set null;
alter table payment_schedules add constraint payment_schedules_project_fk foreign key (project_id) references projects(id) on delete set null;
alter table invoices add constraint invoices_project_fk foreign key (project_id) references projects(id) on delete restrict;
alter table payments add constraint payments_project_fk foreign key (project_id) references projects(id) on delete restrict;
alter table expenses add constraint expenses_project_fk foreign key (project_id) references projects(id) on delete restrict;
alter table email_threads add constraint email_threads_project_fk foreign key (project_id) references projects(id) on delete set null;

create table milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  due_date date,
  owner_id uuid references auth.users(id) on delete set null,
  status milestone_status not null default 'not_started',
  progress smallint not null default 0 check (progress between 0 and 100),
  deliverables text,
  requires_client_approval boolean not null default false,
  approval_status text not null default 'not_required' check (approval_status in ('not_required','pending','approved','rejected')),
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index milestones_project_idx on milestones (project_id, sort_order);
create index milestones_due_idx on milestones (due_date) where status <> 'completed';

alter table payment_schedules add constraint payment_schedules_milestone_fk foreign key (milestone_id) references milestones(id) on delete set null;

create table milestone_dependencies (
  milestone_id uuid not null references milestones(id) on delete cascade,
  depends_on_id uuid not null references milestones(id) on delete cascade,
  primary key (milestone_id, depends_on_id),
  check (milestone_id <> depends_on_id)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete cascade,
  milestone_id uuid references milestones(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  parent_task_id uuid references tasks(id) on delete cascade,
  priority priority_level not null default 'medium',
  status task_status not null default 'pending',
  due_date date,
  start_date date,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  actual_minutes integer not null default 0 check (actual_minutes >= 0),
  is_required boolean not null default true,
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (due_date is null or start_date is null or due_date >= start_date),
  check (parent_task_id is null or parent_task_id <> id)
);
create index tasks_assigned_status_idx on tasks (assigned_to, status, due_date) where archived_at is null;
create index tasks_project_idx on tasks (project_id);
create index tasks_milestone_idx on tasks (milestone_id);
create index tasks_parent_idx on tasks (parent_task_id);
create index tasks_deal_idx on tasks (deal_id);
create index tasks_client_idx on tasks (client_id);
create index tasks_title_trgm_idx on tasks using gin (title extensions.gin_trgm_ops);

alter table meetings add constraint meetings_follow_up_task_fk foreign key (follow_up_task_id) references tasks(id) on delete set null;

create table task_dependencies (
  task_id uuid not null references tasks(id) on delete cascade,
  depends_on_task_id uuid not null references tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  label text not null,
  is_done boolean not null default false,
  done_by uuid references auth.users(id) on delete set null,
  done_at timestamptz,
  sort_order integer not null default 0
);
create index task_checklist_items_task_idx on task_checklist_items (task_id, sort_order);

create table change_requests (
  id uuid primary key default gen_random_uuid(),
  cr_number text not null unique default bos_next_number('change_request'),
  project_id uuid not null references projects(id) on delete restrict,
  client_id uuid not null references clients(id) on delete restrict,
  title text not null,
  description text,
  reason text,
  requested_by_contact_id uuid references contacts(id) on delete set null,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  impact text,
  additional_cost numeric(14,3) not null default 0 check (additional_cost >= 0),
  currency char(3) not null references currencies(code),
  additional_days integer not null default 0 check (additional_days >= 0),
  status change_request_status not null default 'requested',
  approval_group_id uuid,
  invoice_id uuid references invoices(id) on delete set null,
  decided_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index change_requests_project_idx on change_requests (project_id);
create index change_requests_status_idx on change_requests (status);

create table issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  title text not null,
  description text,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  reported_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index issues_project_idx on issues (project_id, status);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid references projects(id) on delete restrict,
  task_id uuid references tasks(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  description text,
  billable boolean not null default true,
  source text not null default 'manual' check (source in ('timer','manual')),
  cost_amount numeric(14,3),
  cost_currency char(3) references currencies(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at),
  check (ended_at is null or ended_at - started_at <= interval '24 hours')
);
create unique index time_entries_running_idx on time_entries (user_id) where ended_at is null;
create index time_entries_project_idx on time_entries (project_id, started_at);
create index time_entries_user_idx on time_entries (user_id, started_at);
create index time_entries_task_idx on time_entries (task_id);

-- Duration + cost snapshot (cost is sensitive; visible only with view_sensitive).
create or replace function public.bos_time_entry_compute()
returns trigger
language plpgsql
as $$
declare
  v_rate numeric;
  v_currency char(3);
begin
  if new.ended_at is not null then
    new.duration_minutes := greatest(1, round(extract(epoch from (new.ended_at - new.started_at)) / 60)::integer);
    select hourly_cost, cost_currency into v_rate, v_currency from employees where user_id = new.user_id;
    if v_rate is not null then
      new.cost_amount := round(v_rate * new.duration_minutes / 60.0, 3);
      new.cost_currency := v_currency;
    end if;
  else
    new.duration_minutes := null;
  end if;
  if new.project_id is not null and new.client_id is null then
    select client_id into new.client_id from projects where id = new.project_id;
  end if;
  return new;
end;
$$;

create trigger time_entries_compute before insert or update of started_at, ended_at, user_id, project_id
on time_entries for each row execute function bos_time_entry_compute();

create or replace function public.bos_time_entry_task_actual()
returns trigger
language plpgsql
as $$
declare
  v_task uuid;
begin
  for v_task in select unnest(array[new.task_id, old.task_id]) loop
    if v_task is not null then
      update tasks set actual_minutes = coalesce((select sum(duration_minutes) from time_entries where task_id = v_task), 0)
       where id = v_task;
    end if;
  end loop;
  return null;
end;
$$;

create trigger time_entries_task_actual after insert or update or delete on time_entries
for each row execute function bos_time_entry_task_actual();

-- ---------------------------------------------------------------------------
-- Onboarding checklists (client + employee share one model)
-- ---------------------------------------------------------------------------

create table onboarding_checklists (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('client','employee')),
  template_key text not null references checklist_templates(key),
  client_id uuid references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  deal_id uuid unique references deals(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','completed','cancelled')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((subject = 'client' and client_id is not null) or (subject = 'employee' and employee_id is not null))
);
create unique index onboarding_employee_active_idx on onboarding_checklists (employee_id) where subject = 'employee' and status <> 'cancelled';

create table onboarding_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references onboarding_checklists(id) on delete cascade,
  section text not null,
  label text not null,
  auto_key text,
  responsible text,
  required boolean not null default true,
  is_done boolean not null default false,
  done_by uuid references auth.users(id) on delete set null,
  done_at timestamptz,
  sort_order integer not null default 0
);
create index onboarding_items_checklist_idx on onboarding_items (checklist_id, sort_order);
create index onboarding_items_auto_idx on onboarding_items (auto_key) where not is_done;

create or replace function public.bos_start_onboarding(p_subject text, p_template_key text, p_client uuid, p_deal uuid, p_project uuid, p_employee uuid, p_due date default null)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if p_subject = 'client' then
    select id into v_id from onboarding_checklists where deal_id = p_deal;
  else
    select id into v_id from onboarding_checklists where employee_id = p_employee and subject = 'employee' and status <> 'cancelled';
  end if;
  if v_id is not null then
    return v_id;
  end if;

  insert into onboarding_checklists (subject, template_key, client_id, project_id, deal_id, employee_id, due_date)
  values (p_subject, p_template_key, p_client, p_project, p_deal, p_employee, p_due)
  returning id into v_id;

  insert into onboarding_items (checklist_id, section, label, auto_key, responsible, required, sort_order)
  select v_id, i->>'section', i->>'label', nullif(i->>'auto_key', ''), i->>'responsible',
         coalesce((i->>'required')::boolean, true), ord
  from checklist_templates t, jsonb_array_elements(t.items) with ordinality as x(i, ord)
  where t.key = p_template_key;

  return v_id;
end;
$$;

-- Marks matching auto items done; completes the checklist when every
-- required item is done. Returns true if the checklist just completed.
create or replace function public.bos_complete_onboarding_item(p_checklist uuid, p_auto_key text, p_actor uuid)
returns boolean
language plpgsql
as $$
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
      jsonb_build_object('checklist_id', p_checklist, 'deal_id', v_cl.deal_id, 'project_id', v_cl.project_id),
      jsonb_build_array(jsonb_build_object('type','deal','id',v_cl.deal_id), jsonb_build_object('type','project','id',v_cl.project_id)),
      'system', 'internal', 'onboarding.completed:' || p_checklist);
    return true;
  end if;
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Progress, health, overdue
-- ---------------------------------------------------------------------------

create or replace function public.bos_recompute_project_progress(p_project uuid)
returns void
language plpgsql
as $$
declare
  v_total integer;
  v_done integer;
  v_progress integer;
begin
  update milestones m set
    progress = coalesce((
      select round(100.0 * count(*) filter (where t.status = 'completed') / nullif(count(*), 0))
      from tasks t where t.milestone_id = m.id and t.status <> 'cancelled' and t.archived_at is null and t.parent_task_id is null
    ), case when m.status = 'completed' then 100 else m.progress end)
  where m.project_id = p_project;

  select count(*) filter (where status <> 'cancelled'),
         count(*) filter (where status = 'completed')
    into v_total, v_done
    from tasks
   where project_id = p_project and is_required and archived_at is null and parent_task_id is null;

  if v_total > 0 then
    v_progress := round(100.0 * v_done / v_total);
  else
    select coalesce(round(100.0 * count(*) filter (where status = 'completed') / nullif(count(*), 0)), 0)
      into v_progress from milestones where project_id = p_project;
  end if;

  update projects set progress = case when status = 'completed' then 100 else v_progress end
   where id = p_project and progress is distinct from (case when status = 'completed' then 100 else v_progress end);
end;
$$;

create or replace function public.bos_tasks_progress_trigger()
returns trigger
language plpgsql
as $$
declare
  v_project uuid := coalesce(new.project_id, old.project_id);
begin
  if v_project is not null then
    perform bos_recompute_project_progress(v_project);
  end if;
  if tg_op = 'UPDATE' and old.project_id is not null and old.project_id is distinct from new.project_id then
    perform bos_recompute_project_progress(old.project_id);
  end if;
  return null;
end;
$$;

create trigger tasks_progress after insert or delete or update of status, project_id, milestone_id, is_required, archived_at
on tasks for each row execute function bos_tasks_progress_trigger();

create or replace function public.bos_recompute_project_health(p_project uuid)
returns project_health
language plpgsql
as $$
declare
  v_p projects%rowtype;
  v_new project_health := 'healthy';
  v_reason text := null;
begin
  select * into v_p from projects where id = p_project for update;
  if v_p.id is null or v_p.status in ('completed','cancelled') then
    return v_p.health;
  end if;

  if v_p.deadline is not null and v_p.deadline < current_date then
    v_new := 'delayed'; v_reason := 'Deadline passed';
  elsif exists (select 1 from milestones where project_id = p_project and status <> 'completed' and due_date < current_date - 2) then
    v_new := 'delayed'; v_reason := 'Milestone overdue';
  elsif exists (select 1 from milestones where project_id = p_project and status = 'blocked') then
    v_new := 'at_risk'; v_reason := 'Blocked milestone';
  elsif exists (select 1 from milestones where project_id = p_project and status <> 'completed'
                and due_date between current_date and current_date + 7 and progress < 50) then
    v_new := 'at_risk'; v_reason := 'Milestone due within 7 days below 50%';
  elsif exists (select 1 from issues where project_id = p_project and severity = 'critical' and status in ('open','in_progress')) then
    v_new := 'at_risk'; v_reason := 'Open critical issue';
  end if;

  if v_new is distinct from v_p.health or v_reason is distinct from v_p.health_reason then
    update projects set health = v_new, health_reason = v_reason where id = p_project;
  end if;

  if v_new = 'delayed' and v_p.health <> 'delayed' then
    perform bos_emit('project.delayed', 'project', p_project, null, 'Project delayed: ' || v_reason,
      jsonb_build_object('project_id', p_project, 'reason', v_reason, 'pm_id', v_p.pm_id, 'client_id', v_p.client_id),
      jsonb_build_array(jsonb_build_object('type','client','id',v_p.client_id)),
      'system', 'internal', 'project.delayed:' || p_project || ':' || current_date);
  end if;

  return v_new;
end;
$$;

create or replace function public.bos_recompute_all_project_health()
returns integer
language plpgsql
as $$
declare
  v_id uuid;
  v_n integer := 0;
begin
  for v_id in select id from projects where status not in ('completed','cancelled') and archived_at is null loop
    perform bos_recompute_project_health(v_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Marks overdue tasks/activities and emits one event per item per day
-- (payload.overdue_days lets automations escalate after N days).
create or replace function public.bos_mark_overdue_work(p_today date default current_date)
returns integer
language plpgsql
as $$
declare
  v_t record;
  v_n integer := 0;
begin
  for v_t in
    select * from tasks
    where archived_at is null and due_date is not null and due_date < p_today
      and status in ('pending','in_progress','blocked','overdue')
  loop
    if v_t.status <> 'overdue' then
      update tasks set status = 'overdue' where id = v_t.id;
      perform bos_status('task', v_t.id, v_t.status::text, 'overdue', null, 'Past due date');
    end if;
    if bos_emit('task.overdue', 'task', v_t.id, null, 'Task overdue: ' || v_t.title,
        jsonb_build_object('task_id', v_t.id, 'title', v_t.title, 'assignee_user_id', v_t.assigned_to, 'due_date', v_t.due_date,
                           'overdue_days', p_today - v_t.due_date, 'project_id', v_t.project_id, 'kind', 'task'),
        jsonb_build_array(jsonb_build_object('type','project','id',v_t.project_id), jsonb_build_object('type','deal','id',v_t.deal_id),
                          jsonb_build_object('type','lead','id',v_t.lead_id), jsonb_build_object('type','client','id',v_t.client_id)),
        'system', 'internal', 'task.overdue:' || v_t.id || ':' || p_today) is not null then
      v_n := v_n + 1;
    end if;
  end loop;

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
                          jsonb_build_object('type','client','id',v_t.client_id), jsonb_build_object('type','project','id',v_t.project_id)),
        'system', 'internal', 'activity.overdue:' || v_t.id || ':' || p_today) is not null then
      v_n := v_n + 1;
    end if;
  end loop;

  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Assignment helpers
-- ---------------------------------------------------------------------------

-- Active staff user holding a role with the least open work of the given kind.
create or replace function public.bos_pick_user_for_role(p_role_key text, p_kind text default 'tasks')
returns uuid
language sql
stable
as $$
  select e.user_id
  from employees e
  join user_roles ur on ur.user_id = e.user_id
  join roles r on r.id = ur.role_id and r.key = p_role_key
  where e.user_id is not null and e.lifecycle_status in ('active','onboarding') and e.archived_at is null
  order by
    case p_kind
      when 'projects' then (select count(*) from projects p where p.pm_id = e.user_id and p.status not in ('completed','cancelled'))
      when 'leads' then (select count(*) from leads l where l.assigned_to = e.user_id and l.archived_at is null)
      else (select count(*) from tasks t where t.assigned_to = e.user_id and t.status in ('pending','in_progress','blocked','overdue'))
    end,
    (select max(created_at) from projects p2 where p2.pm_id = e.user_id) nulls first,
    e.created_at
  limit 1;
$$;

create or replace function public.bos_pick_pm()
returns uuid
language plpgsql
stable
as $$
declare
  v_cfg jsonb := coalesce((select value from bos_settings where key = 'delivery'), '{}'::jsonb);
begin
  case coalesce(v_cfg->>'pm_assignment', 'round_robin')
    when 'manual' then return null;
    when 'specific' then return nullif(v_cfg->>'pm_user_id', '')::uuid;
    else return bos_pick_user_for_role('project_manager', 'projects');
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- DEAL WON — the core lifecycle transition (§3, §20, §106 step 13).
-- Idempotent: a deal is processed once; re-invocation returns the project.
-- ---------------------------------------------------------------------------

create or replace function public.bos_process_deal_won(p_deal_id uuid, p_actor uuid)
returns uuid
language plpgsql
as $$
declare
  v_deal deals%rowtype;
  v_sales jsonb := coalesce((select value from bos_settings where key = 'sales'), '{}'::jsonb);
  v_fin jsonb := coalesce((select value from bos_settings where key = 'finance'), '{}'::jsonb);
  v_won_stage uuid;
  v_old_stage_key text;
  v_lead_won_stage uuid;
  v_contract contracts%rowtype;
  v_template project_templates%rowtype;
  v_project uuid;
  v_pm uuid;
  v_start date;
  v_deadline date;
  v_ms jsonb;
  v_task jsonb;
  v_ms_id uuid;
  v_ms_ord integer := 0;
  v_task_ord integer;
  v_assignee uuid;
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
    return (select id from projects where deal_id = p_deal_id);
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
                       'value_base', v_deal.value * coalesce(bos_fx_rate(v_deal.currency, coalesce((select value->>'base_currency' from bos_settings where key='company'), 'USD')::char(3)), 0),
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

  -- 4. Project template (product-specific first, else default)
  select t.* into v_template from project_templates t
   where t.is_active and t.product_id is not null
     and exists (select 1 from deal_products dp where dp.deal_id = p_deal_id and dp.product_id = t.product_id)
   order by t.created_at limit 1;
  if v_template.id is null then
    select * into v_template from project_templates where is_default and is_active limit 1;
  end if;

  v_start := coalesce(v_contract.start_date, current_date);
  if v_template.id is not null then
    select v_start + coalesce(max((m->>'offset_days')::int + (m->>'duration_days')::int), 30)
      into v_deadline from jsonb_array_elements(v_template.milestones) m;
  end if;
  v_deadline := coalesce(v_contract.end_date, v_deadline, v_start + 30);

  -- 5. PM
  v_pm := bos_pick_pm();

  -- 6. Project (unique deal_id ⇒ never duplicated)
  insert into projects (name, client_id, primary_contact_id, deal_id, contract_id, template_id, pm_id, status, budget, currency,
                        scope, start_date, deadline, created_by)
  values (v_deal.name, v_deal.client_id, v_deal.contact_id, p_deal_id, v_contract.id, v_template.id, v_pm, 'planning',
          v_deal.value, v_deal.currency, v_deal.scope, v_start, v_deadline, p_actor)
  on conflict (deal_id) do nothing
  returning id into v_project;

  if v_project is null then
    select id into v_project from projects where deal_id = p_deal_id;
  else
    perform bos_status('project', v_project, null, 'planning', p_actor, 'Created from deal ' || v_deal.deal_number);
    perform bos_audit(p_actor, 'project.created', 'project', v_project, null,
      jsonb_build_object('deal_id', p_deal_id, 'budget', v_deal.value, 'currency', v_deal.currency, 'pm_id', v_pm),
      null, jsonb_build_object('automation', 'deal_won'), 'automation');

    if v_contract.id is not null then
      update contracts set project_id = v_project where id = v_contract.id and project_id is null;
    end if;

    -- 7. Team
    if v_pm is not null then
      insert into project_members (project_id, user_id, role_label) values (v_project, v_pm, 'Project Manager') on conflict do nothing;
    end if;
    if v_deal.assigned_to is not null then
      insert into project_members (project_id, user_id, role_label) values (v_project, v_deal.assigned_to, 'Business Development (observer)') on conflict do nothing;
    end if;

    -- 8. Milestones + tasks from template
    if v_template.id is not null then
      for v_ms in select * from jsonb_array_elements(v_template.milestones) loop
        v_ms_ord := v_ms_ord + 1;
        insert into milestones (project_id, name, due_date, owner_id, requires_client_approval, approval_status, sort_order)
        values (v_project, v_ms->>'name',
                v_start + coalesce((v_ms->>'offset_days')::int, 0) + coalesce((v_ms->>'duration_days')::int, 0),
                v_pm, coalesce((v_ms->>'requires_client_approval')::boolean, false),
                case when coalesce((v_ms->>'requires_client_approval')::boolean, false) then 'pending' else 'not_required' end,
                v_ms_ord)
        returning id into v_ms_id;

        v_task_ord := 0;
        for v_task in select * from jsonb_array_elements(coalesce(v_ms->'tasks', '[]'::jsonb)) loop
          v_task_ord := v_task_ord + 1;
          v_assignee := case
            when coalesce(v_task->>'role_key', 'project_manager') = 'project_manager' then v_pm
            else bos_pick_user_for_role(v_task->>'role_key', 'tasks') end;
          insert into tasks (title, assigned_to, created_by, client_id, project_id, milestone_id, deal_id, priority, status,
                             start_date, due_date, estimated_minutes, is_required, sort_order)
          values (v_task->>'title', v_assignee, p_actor, v_deal.client_id, v_project, v_ms_id, p_deal_id, 'medium', 'pending',
                  v_start + coalesce((v_ms->>'offset_days')::int, 0),
                  v_start + coalesce((v_ms->>'offset_days')::int, 0) + coalesce((v_ms->>'duration_days')::int, 0),
                  nullif(v_task->>'estimated_minutes', '')::int, coalesce((v_task->>'required')::boolean, true), v_task_ord);
          if v_assignee is not null then
            insert into project_members (project_id, user_id, role_label)
            values (v_project, v_assignee, initcap(replace(coalesce(v_task->>'role_key', 'member'), '_', ' ')))
            on conflict do nothing;
          end if;
        end loop;
      end loop;
    end if;

    -- 9. Payment schedule from deal payment terms (last row absorbs rounding ⇒ Σ = deal value exactly)
    for v_term in select * from jsonb_array_elements(v_deal.payment_terms) loop
      v_i := v_i + 1;
      if v_i = v_terms_count then
        v_amount := v_deal.value - v_allocated;
      else
        v_amount := bos_round_money(v_deal.value * (v_term->>'percent')::numeric / 100, v_deal.currency);
      end if;
      v_allocated := v_allocated + v_amount;

      insert into payment_schedules (deal_id, project_id, client_id, label, percent, amount, currency, due_date, trigger, sort_order)
      values (p_deal_id, v_project, v_deal.client_id,
              coalesce(nullif(v_term->>'label', ''), 'Installment ' || v_i),
              (v_term->>'percent')::numeric, v_amount, v_deal.currency,
              v_start + coalesce(nullif(v_term->>'due_offset_days', '')::int, 0),
              coalesce(nullif(v_term->>'trigger', ''), case when v_i = 1 then 'on_signing' else 'on_date' end)::schedule_trigger,
              v_i)
      on conflict (deal_id, sort_order) do nothing
      returning id into v_schedule_id;

      if v_i = 1 then v_first_schedule := v_schedule_id; end if;
    end loop;

    -- 10. First invoice(s): every on_signing installment (unique schedule_id ⇒ no duplicates)
    for v_schedule_id in
      select id from payment_schedules
       where deal_id = p_deal_id and invoice_id is null and status = 'scheduled'
         and (trigger = 'on_signing' or (id = v_first_schedule and not exists (
               select 1 from payment_schedules ps2 where ps2.deal_id = p_deal_id and ps2.trigger = 'on_signing')))
       order by sort_order
    loop
      v_invoice := bos_create_invoice_from_schedule(v_schedule_id, p_actor);
    end loop;

    -- 11. Commission
    perform bos_evaluate_commissions(p_deal_id, p_actor);

    -- 12. Client onboarding
    v_checklist := bos_start_onboarding('client', 'client_onboarding', v_deal.client_id, p_deal_id, v_project, null, v_start + 7);
    perform bos_complete_onboarding_item(v_checklist, 'project_created', p_actor);
    if v_pm is not null then
      perform bos_complete_onboarding_item(v_checklist, 'team_assigned', p_actor);
    end if;
    if v_contract.status = 'signed' then
      perform bos_complete_onboarding_item(v_checklist, 'contract_signed', p_actor);
    end if;
    if exists (select 1 from payments where deal_id = p_deal_id and status = 'completed') then
      perform bos_complete_onboarding_item(v_checklist, 'initial_payment', p_actor);
    end if;

    v_links := v_links || jsonb_build_array(jsonb_build_object('type','deal','id',p_deal_id));

    perform bos_emit('project.created', 'project', v_project, p_actor, 'Project created from deal ' || v_deal.deal_number,
      jsonb_build_object('project_id', v_project, 'deal_id', p_deal_id, 'pm_id', v_pm, 'client_id', v_deal.client_id,
                         'budget', v_deal.value, 'currency', v_deal.currency, 'owner_user_id', v_deal.assigned_to),
      v_links, 'automation', 'internal', 'project.created:' || v_project);

    if v_pm is not null then
      perform bos_emit('project.pm_assigned', 'project', v_project, p_actor, 'PM assigned',
        jsonb_build_object('project_id', v_project, 'pm_id', v_pm, 'deal_id', p_deal_id),
        v_links, 'automation', 'internal', 'project.pm_assigned:' || v_project || ':' || v_pm);
    else
      perform bos_emit('project.pm_assignment_required', 'project', v_project, p_actor, 'Project needs a PM',
        jsonb_build_object('project_id', v_project, 'deal_id', p_deal_id),
        v_links, 'automation', 'internal', 'project.pm_assignment_required:' || v_project);
    end if;

    perform bos_emit('onboarding.started', 'client', v_deal.client_id, p_actor, 'Client onboarding started',
      jsonb_build_object('checklist_id', v_checklist, 'deal_id', p_deal_id, 'project_id', v_project),
      jsonb_build_array(jsonb_build_object('type','deal','id',p_deal_id), jsonb_build_object('type','project','id',v_project)),
      'automation', 'internal', 'onboarding.started:' || v_checklist);
  end if;

  update deals set won_processed_at = now() where id = p_deal_id;
  return v_project;
end;
$$;

create or replace function public.bos_create_invoice_from_schedule(p_schedule_id uuid, p_actor uuid)
returns uuid
language plpgsql
as $$
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

  insert into invoices (client_id, project_id, deal_id, schedule_id, currency, issue_date, due_date, status, payment_terms, sent_at, created_by)
  values (v_s.client_id, v_s.project_id, v_s.deal_id, v_s.id, v_s.currency, current_date,
          greatest(current_date, coalesce(v_s.due_date, current_date)) + coalesce((v_fin->>'default_payment_due_days')::int, 7),
          v_status, v_s.label || ' (' || v_s.percent || '%)', case when v_status = 'sent' then now() end, p_actor)
  on conflict (schedule_id) do nothing
  returning id into v_invoice;

  if v_invoice is null then
    select id into v_invoice from invoices where schedule_id = p_schedule_id;
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
    jsonb_build_object('invoice_id', v_invoice, 'amount', v_s.amount, 'currency', v_s.currency, 'deal_id', v_s.deal_id, 'project_id', v_s.project_id, 'client_id', v_s.client_id),
    jsonb_build_array(jsonb_build_object('type','client','id',v_s.client_id), jsonb_build_object('type','deal','id',v_s.deal_id),
                      jsonb_build_object('type','project','id',v_s.project_id)),
    'automation', 'internal', 'invoice.created:' || v_invoice);

  return v_invoice;
end;
$$;

-- ---------------------------------------------------------------------------
-- Change requests: apply approved CR to the project (§25)
-- ---------------------------------------------------------------------------

create or replace function public.bos_apply_change_request(p_cr uuid, p_actor uuid)
returns void
language plpgsql
as $$
declare
  v_cr change_requests%rowtype;
  v_p projects%rowtype;
  v_rate numeric;
  v_add numeric;
  v_invoice uuid;
begin
  select * into v_cr from change_requests where id = p_cr for update;
  if v_cr.status <> 'approved' then
    raise exception 'Only approved change requests can be added to the project' using errcode = '22023';
  end if;
  select * into v_p from projects where id = v_cr.project_id for update;

  v_rate := bos_fx_rate(v_cr.currency, v_p.currency);
  if v_rate is null then
    raise exception 'Exchange rate % → % is required to apply this change request', v_cr.currency, v_p.currency using errcode = '22023';
  end if;
  v_add := bos_round_money(v_cr.additional_cost * v_rate, v_p.currency);

  update projects
     set budget = budget + v_add,
         deadline = case when deadline is not null then deadline + v_cr.additional_days else deadline end,
         scope = coalesce(scope, '') || E'\n\n[' || v_cr.cr_number || '] ' || v_cr.title || coalesce(E'\n' || v_cr.description, '')
   where id = v_p.id;

  if v_cr.additional_cost > 0 then
    insert into invoices (client_id, project_id, deal_id, currency, issue_date, due_date, status, payment_terms, created_by)
    values (v_cr.client_id, v_p.id, v_p.deal_id, v_cr.currency, current_date,
            current_date + coalesce((select (value->>'default_payment_due_days')::int from bos_settings where key = 'finance'), 7),
            'draft', 'Change request ' || v_cr.cr_number, p_actor)
    returning id into v_invoice;
    insert into invoice_items (invoice_id, description, quantity, unit_price)
    values (v_invoice, v_cr.cr_number || ' — ' || v_cr.title, 1, v_cr.additional_cost);
    perform bos_status('invoice', v_invoice, null, 'draft', p_actor, 'Change request ' || v_cr.cr_number);
  end if;

  update change_requests set status = 'added_to_project', applied_at = now(), invoice_id = v_invoice where id = p_cr;
  perform bos_status('change_request', p_cr, 'approved', 'added_to_project', p_actor, null);
  perform bos_audit(p_actor, 'project.change_request_applied', 'project', v_p.id,
    jsonb_build_object('budget', v_p.budget, 'deadline', v_p.deadline),
    jsonb_build_object('budget', v_p.budget + v_add, 'deadline', v_p.deadline + v_cr.additional_days, 'change_request', v_cr.cr_number));
  perform bos_emit('change_request.applied', 'change_request', p_cr, p_actor,
    v_cr.cr_number || ' added to project (+' || v_add || ' ' || v_p.currency || ', +' || v_cr.additional_days || ' days)',
    jsonb_build_object('project_id', v_p.id, 'additional_cost', v_add, 'additional_days', v_cr.additional_days, 'pm_id', v_p.pm_id),
    jsonb_build_array(jsonb_build_object('type','project','id',v_p.id), jsonb_build_object('type','client','id',v_cr.client_id)));
end;
$$;

-- ---------------------------------------------------------------------------
-- Project completion gate (§84)
-- ---------------------------------------------------------------------------

create or replace function public.bos_project_completion_blockers(p_project uuid)
returns text[]
language plpgsql
stable
as $$
declare
  v_cfg jsonb := coalesce((select value from bos_settings where key = 'project_completion'), '{}'::jsonb);
  v_p projects%rowtype;
  v_blockers text[] := '{}';
begin
  select * into v_p from projects where id = p_project;

  if exists (select 1 from tasks where project_id = p_project and is_required and archived_at is null
             and parent_task_id is null and status not in ('completed','cancelled')) then
    v_blockers := v_blockers || 'required_tasks_incomplete';
  end if;

  if to_regclass('public.bugs') is not null then
    if exists (select 1 from bugs where project_id = p_project and severity in ('critical','major') and status not in ('fixed','closed')) then
      v_blockers := v_blockers || 'qa_open_bugs';
    end if;
  end if;

  if not coalesce((v_cfg->>'allow_complete_with_pending_approvals')::boolean, false) then
    if not exists (select 1 from approvals where entity_type = 'project' and entity_id = p_project
                   and approval_type = 'final_delivery' and status = 'approved') then
      v_blockers := v_blockers || 'final_approval_missing';
    end if;
    if exists (select 1 from approvals where status = 'pending' and (
                (entity_type = 'project' and entity_id = p_project) or
                (entity_type = 'milestone' and entity_id in (select id from milestones where project_id = p_project)) or
                (entity_type = 'change_request' and entity_id in (select id from change_requests where project_id = p_project)))) then
      v_blockers := v_blockers || 'pending_approvals';
    end if;
  end if;

  if not coalesce((v_cfg->>'allow_complete_with_pending_payment')::boolean, false) then
    if exists (select 1 from invoices where project_id = p_project and status not in ('paid','cancelled'))
       or (v_p.deal_id is not null and (select payment_status from deals where id = v_p.deal_id) <> 'paid') then
      v_blockers := v_blockers || 'final_payment_pending';
    end if;
  end if;

  return v_blockers;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers, RLS, grants
-- ---------------------------------------------------------------------------

create trigger project_templates_touch before update on project_templates for each row execute function bos_touch_updated_at();
create trigger projects_touch before update on projects for each row execute function bos_touch_updated_at();
create trigger milestones_touch before update on milestones for each row execute function bos_touch_updated_at();
create trigger tasks_touch before update on tasks for each row execute function bos_touch_updated_at();
create trigger change_requests_touch before update on change_requests for each row execute function bos_touch_updated_at();
create trigger issues_touch before update on issues for each row execute function bos_touch_updated_at();
create trigger time_entries_touch before update on time_entries for each row execute function bos_touch_updated_at();

alter table project_templates enable row level security;
alter table checklist_templates enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table milestones enable row level security;
alter table milestone_dependencies enable row level security;
alter table tasks enable row level security;
alter table task_dependencies enable row level security;
alter table task_checklist_items enable row level security;
alter table change_requests enable row level security;
alter table issues enable row level security;
alter table time_entries enable row level security;
alter table onboarding_checklists enable row level security;
alter table onboarding_items enable row level security;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

revoke execute on function
  public.bos_start_onboarding(text, text, uuid, uuid, uuid, uuid, date),
  public.bos_complete_onboarding_item(uuid, text, uuid),
  public.bos_recompute_project_progress(uuid),
  public.bos_recompute_project_health(uuid),
  public.bos_recompute_all_project_health(),
  public.bos_mark_overdue_work(date),
  public.bos_pick_user_for_role(text, text),
  public.bos_pick_pm(),
  public.bos_process_deal_won(uuid, uuid),
  public.bos_create_invoice_from_schedule(uuid, uuid),
  public.bos_apply_change_request(uuid, uuid),
  public.bos_project_completion_blockers(uuid)
from public, anon, authenticated;
