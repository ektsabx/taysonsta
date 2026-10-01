-- Taysonsta BOS — roles, permission catalogue, default role scopes,
-- default notification subscriptions, and bootstrap of existing staff users.
-- See docs/bos/03-auth-permissions.md and 24-notifications.md.

-- Permission catalogue: every module × every action (§62).
insert into permissions (key, module, action, description)
select m || '.' || a::text, m, a, initcap(replace(m, '_', ' ')) || ' — ' || replace(a::text, '_', ' ')
from unnest(array[
  'dashboard','leads','deals','activities','proposals','contracts','invoices','payments','commissions',
  'expenses','vendors','revenue','clients','contacts','communications','projects','milestones','tasks',
  'change_requests','issues','approvals','files','employees','attendance','timesheets','leave','overtime',
  'kpis','performance','onboarding','access','devices','apps','chat','meetings','email','notifications',
  'knowledge','tickets','bugs','feature_requests','reports','automation','settings','users','roles','audit',
  'portal','calendar','search'
]) as m
cross join unnest(enum_range(null::permission_action)) as a;

-- System roles (§61).
insert into roles (key, name, description, is_system, is_client_role, sort_order) values
  ('super_admin', 'Super Admin', 'Full access to everything, including security and roles.', true, false, 1),
  ('admin', 'Admin', 'Administers the BOS: users, settings, all modules.', true, false, 2),
  ('executive', 'Executive', 'Company-wide read access, reports and sensitive financials.', true, false, 3),
  ('sales_manager', 'Sales Manager', 'Manages the sales team, leads, deals and proposals.', true, false, 4),
  ('business_development', 'Business Development', 'Works own leads, deals, proposals and activities.', true, false, 5),
  ('account_manager', 'Account Manager', 'Owns client relationships, upsell and renewals.', true, false, 6),
  ('project_manager', 'Project Manager', 'Runs delivery for assigned projects.', true, false, 7),
  ('product_manager', 'Product Manager', 'Owns product scope, feature requests and bugs triage.', true, false, 8),
  ('designer', 'Designer', 'Delivers design work on assigned projects.', true, false, 9),
  ('developer', 'Developer', 'Delivers development work on assigned projects.', true, false, 10),
  ('qa', 'QA', 'Tests deliverables and manages QA status of bugs.', true, false, 11),
  ('finance', 'Finance', 'Invoices, payments, expenses, commissions, revenue.', true, false, 12),
  ('hr', 'HR', 'Employees, attendance, leave, KPIs, onboarding, access, devices.', true, false, 13),
  ('support', 'Support', 'Client support tickets.', true, false, 14),
  ('client', 'Client', 'Client portal user. Sees only their own account data.', true, true, 15);

create or replace function pg_temp.grant_perms(p_role text, p_modules text[], p_actions text[], p_scope permission_scope)
returns void
language sql
as $$
  insert into role_permissions (role_id, permission_id, scope)
  select r.id, p.id, p_scope
  from roles r
  join permissions p on p.module = any(p_modules) and p.action::text = any(p_actions)
  where r.key = p_role
  on conflict (role_id, permission_id) do update
    set scope = case
      when array_position(enum_range(null::permission_scope), excluded.scope) >
           array_position(enum_range(null::permission_scope), role_permissions.scope)
      then excluded.scope else role_permissions.scope end;
$$;

-- Baseline for every staff role (docs/bos/03 "Every employee additionally has").
do $$
declare
  r text;
begin
  foreach r in array array['super_admin','admin','executive','sales_manager','business_development','account_manager',
                           'project_manager','product_manager','designer','developer','qa','finance','hr','support']
  loop
    perform pg_temp.grant_perms(r, array['dashboard','calendar','search'], array['read'], 'own');
    perform pg_temp.grant_perms(r, array['tasks'], array['create','read','update'], 'assigned');
    perform pg_temp.grant_perms(r, array['attendance','leave','overtime'], array['create','read'], 'own');
    perform pg_temp.grant_perms(r, array['timesheets'], array['create','read'], 'own');
    perform pg_temp.grant_perms(r, array['notifications'], array['read','update'], 'own');
    perform pg_temp.grant_perms(r, array['chat'], array['create','read'], 'assigned');
    perform pg_temp.grant_perms(r, array['knowledge'], array['read'], 'all');
    perform pg_temp.grant_perms(r, array['files'], array['create','read'], 'assigned');
    perform pg_temp.grant_perms(r, array['meetings'], array['read'], 'assigned');
    perform pg_temp.grant_perms(r, array['approvals'], array['read'], 'own');
    perform pg_temp.grant_perms(r, array['access'], array['create','read'], 'own');
    perform pg_temp.grant_perms(r, array['devices','onboarding','kpis','performance','commissions'], array['read'], 'own');
    perform pg_temp.grant_perms(r, array['employees'], array['read'], 'all');
  end loop;
end;
$$;

-- Super Admin & Admin: everything, all records.
select pg_temp.grant_perms('super_admin',
  array(select distinct module from permissions), array(select unnest(enum_range(null::permission_action))::text), 'all');
select pg_temp.grant_perms('admin',
  array(select distinct module from permissions where module <> 'portal'), array(select unnest(enum_range(null::permission_action))::text), 'all');

-- Executive: read everything, reports, sensitive financials, approve.
select pg_temp.grant_perms('executive', array(select distinct module from permissions where module not in ('portal','settings','users','roles')), array['read','export'], 'all');
select pg_temp.grant_perms('executive', array['revenue','invoices','payments','commissions','projects','expenses','employees','deals'], array['view_sensitive'], 'all');
select pg_temp.grant_perms('executive', array['approvals'], array['approve'], 'all');

-- Sales Manager.
select pg_temp.grant_perms('sales_manager', array['leads','deals','activities','proposals','meetings','contacts','clients','contracts'], array['create','read','update','assign','export','delete'], 'team');
select pg_temp.grant_perms('sales_manager', array['contacts','clients'], array['read'], 'all');
select pg_temp.grant_perms('sales_manager', array['commissions','kpis','performance','timesheets'], array['read'], 'team');
select pg_temp.grant_perms('sales_manager', array['reports'], array['read','export'], 'team');
select pg_temp.grant_perms('sales_manager', array['proposals','deals','approvals'], array['approve'], 'team');
select pg_temp.grant_perms('sales_manager', array['communications','email'], array['read'], 'team');
select pg_temp.grant_perms('sales_manager', array['tasks'], array['read','assign'], 'team');
select pg_temp.grant_perms('sales_manager', array['knowledge'], array['create','update'], 'all');
select pg_temp.grant_perms('sales_manager', array['deals'], array['view_sensitive'], 'team');

-- Business Development.
select pg_temp.grant_perms('business_development', array['leads','deals','activities','proposals','meetings','contracts'], array['create','read','update'], 'assigned');
select pg_temp.grant_perms('business_development', array['leads','deals'], array['export'], 'assigned');
select pg_temp.grant_perms('business_development', array['contacts','clients'], array['create','read'], 'all');
select pg_temp.grant_perms('business_development', array['contacts','clients'], array['update'], 'assigned');
select pg_temp.grant_perms('business_development', array['communications','email'], array['read'], 'assigned');
select pg_temp.grant_perms('business_development', array['knowledge'], array['read'], 'all');
select pg_temp.grant_perms('business_development', array['invoices','payments'], array['read'], 'assigned');

-- Account Manager.
select pg_temp.grant_perms('account_manager', array['clients','contacts'], array['create','read','update'], 'assigned');
select pg_temp.grant_perms('account_manager', array['clients','contacts'], array['read'], 'all');
select pg_temp.grant_perms('account_manager', array['deals','activities','meetings','proposals'], array['create','read','update'], 'assigned');
select pg_temp.grant_perms('account_manager', array['projects','milestones','tickets','feature_requests','invoices','payments','communications','email','change_requests'], array['read'], 'assigned');
select pg_temp.grant_perms('account_manager', array['tickets','feature_requests'], array['create'], 'assigned');
select pg_temp.grant_perms('account_manager', array['portal'], array['manage'], 'assigned');

-- Project Manager.
select pg_temp.grant_perms('project_manager', array['projects','milestones','tasks','change_requests','issues','files','approvals','meetings'], array['create','read','update','assign','manage'], 'assigned');
select pg_temp.grant_perms('project_manager', array['approvals','change_requests'], array['approve'], 'assigned');
select pg_temp.grant_perms('project_manager', array['timesheets'], array['read'], 'team');
select pg_temp.grant_perms('project_manager', array['clients','contacts','invoices','payments','communications','bugs','tickets','feature_requests'], array['read'], 'assigned');
select pg_temp.grant_perms('project_manager', array['bugs','tickets'], array['create','update'], 'assigned');
select pg_temp.grant_perms('project_manager', array['portal'], array['manage'], 'assigned');
select pg_temp.grant_perms('project_manager', array['reports'], array['read'], 'assigned');
select pg_temp.grant_perms('project_manager', array['knowledge'], array['create','update'], 'all');
select pg_temp.grant_perms('project_manager', array['chat'], array['manage'], 'assigned');

-- Product Manager.
select pg_temp.grant_perms('product_manager', array['projects','milestones','tasks'], array['read','update'], 'assigned');
select pg_temp.grant_perms('product_manager', array['feature_requests'], array['create','read','update','manage','approve'], 'all');
select pg_temp.grant_perms('product_manager', array['bugs'], array['create','read','update'], 'all');
select pg_temp.grant_perms('product_manager', array['knowledge'], array['create','update'], 'all');

-- Designer / Developer / QA.
select pg_temp.grant_perms('designer', array['projects','milestones'], array['read'], 'assigned');
select pg_temp.grant_perms('designer', array['files'], array['update'], 'assigned');
select pg_temp.grant_perms('developer', array['projects','milestones'], array['read'], 'assigned');
select pg_temp.grant_perms('developer', array['bugs'], array['read','update'], 'assigned');
select pg_temp.grant_perms('developer', array['files'], array['update'], 'assigned');
select pg_temp.grant_perms('developer', array['knowledge'], array['create','update'], 'own');
select pg_temp.grant_perms('qa', array['projects','milestones'], array['read'], 'assigned');
select pg_temp.grant_perms('qa', array['bugs'], array['create','read','update'], 'all');
select pg_temp.grant_perms('qa', array['issues'], array['create','read','update'], 'assigned');

-- Finance.
select pg_temp.grant_perms('finance', array['invoices','payments','expenses','vendors','commissions','revenue','contracts'], array['create','read','update','delete','approve','export','manage','view_sensitive'], 'all');
select pg_temp.grant_perms('finance', array['deals','projects','clients','contacts'], array['read'], 'all');
select pg_temp.grant_perms('finance', array['projects','deals'], array['view_sensitive'], 'all');
select pg_temp.grant_perms('finance', array['reports'], array['read','export'], 'all');
select pg_temp.grant_perms('finance', array['approvals'], array['approve'], 'all');
select pg_temp.grant_perms('finance', array['timesheets'], array['read'], 'all');

-- HR.
select pg_temp.grant_perms('hr', array['employees','attendance','leave','overtime','kpis','performance','onboarding','access','devices','apps','timesheets'], array['create','read','update','approve','export','manage'], 'all');
select pg_temp.grant_perms('hr', array['employees'], array['view_sensitive','delete','assign'], 'all');
select pg_temp.grant_perms('hr', array['approvals'], array['approve'], 'all');
select pg_temp.grant_perms('hr', array['reports'], array['read'], 'all');
select pg_temp.grant_perms('hr', array['knowledge'], array['create','update','manage'], 'all');
select pg_temp.grant_perms('hr', array['users'], array['read','create','update'], 'all');

-- Support.
select pg_temp.grant_perms('support', array['tickets'], array['create','read','update','assign','manage'], 'all');
select pg_temp.grant_perms('support', array['bugs','feature_requests'], array['create','read'], 'all');
select pg_temp.grant_perms('support', array['clients','contacts','projects'], array['read'], 'all');
select pg_temp.grant_perms('support', array['knowledge'], array['create','update'], 'all');

-- Managers (any role) approve their team's leave/overtime/corrections via the
-- approval engine's "manager" resolution; that is evaluated per approval, not
-- through a role permission.

-- ---------------------------------------------------------------------------
-- Default notification subscriptions (§41, §77) — editable in Settings.
-- ---------------------------------------------------------------------------

create or replace function pg_temp.sub_relation(p_event text, p_relation text, p_channels text[] default array['in_app'], p_configurable boolean default true)
returns void language sql as $$
  insert into notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
  values (p_event, 'relation', p_relation, p_channels, p_configurable);
$$;

create or replace function pg_temp.sub_role(p_event text, p_role text, p_channels text[] default array['in_app'])
returns void language sql as $$
  insert into notification_subscriptions (event_type, subscriber_kind, role_id, channels)
  select p_event, 'role', id, p_channels from roles where key = p_role;
$$;

select pg_temp.sub_relation('lead.assigned', 'assignee', array['in_app','email']);
select pg_temp.sub_relation('lead.assigned', 'previous_assignee');
select pg_temp.sub_relation('lead.replied', 'assignee', array['in_app','email']);
select pg_temp.sub_relation('meeting.upcoming', 'assignee', array['in_app','email']);
select pg_temp.sub_relation('meeting.scheduled', 'assignee');
select pg_temp.sub_relation('activity.reminder_due', 'assignee', array['in_app','email']);
select pg_temp.sub_relation('task.assigned', 'assignee', array['in_app','email']);
select pg_temp.sub_relation('task.overdue', 'assignee', array['in_app'], false);
select pg_temp.sub_relation('task.completed', 'creator');
select pg_temp.sub_relation('deal.updated', 'owner');
select pg_temp.sub_relation('deal.stage_changed', 'owner');
select pg_temp.sub_role('deal.stage_changed', 'sales_manager');
select pg_temp.sub_role('deal.won', 'sales_manager', array['in_app','email']);
select pg_temp.sub_role('deal.won', 'finance', array['in_app','email']);
select pg_temp.sub_role('deal.won', 'executive', array['in_app','email']);
select pg_temp.sub_relation('deal.won', 'owner', array['in_app','email']);
select pg_temp.sub_relation('deal.won', 'pm', array['in_app','email']);
select pg_temp.sub_role('deal.lost', 'sales_manager');
select pg_temp.sub_relation('project.pm_assigned', 'pm', array['in_app','email']);
select pg_temp.sub_role('project.pm_assignment_required', 'admin', array['in_app','email']);
select pg_temp.sub_role('payment.completed', 'finance', array['in_app','email']);
select pg_temp.sub_relation('payment.completed', 'bd');
select pg_temp.sub_relation('payment.completed', 'pm');
select pg_temp.sub_role('payment.failed', 'finance');
select pg_temp.sub_role('invoice.overdue', 'finance', array['in_app','email']);
select pg_temp.sub_relation('invoice.overdue', 'account_manager');
select pg_temp.sub_relation('project.delayed', 'pm', array['in_app','email']);
select pg_temp.sub_role('project.delayed', 'executive');
select pg_temp.sub_relation('project.completed', 'account_manager');
select pg_temp.sub_relation('project.completed', 'bd');
select pg_temp.sub_relation('approval.requested', 'approver', array['in_app','email'], false);
select pg_temp.sub_relation('approval.decided', 'creator', array['in_app','email']);
select pg_temp.sub_relation('chat.client_message', 'project_members');
select pg_temp.sub_relation('chat.client_message', 'account_manager');
select pg_temp.sub_relation('chat.mentioned', 'assignee', array['in_app'], false);
select pg_temp.sub_role('ticket.created', 'support', array['in_app','email']);
select pg_temp.sub_relation('ticket.assigned', 'assignee', array['in_app','email']);
select pg_temp.sub_relation('ticket.replied', 'assignee');
select pg_temp.sub_relation('ticket.sla_breached', 'assignee', array['in_app','email'], false);
select pg_temp.sub_role('ticket.sla_breached', 'support');
select pg_temp.sub_relation('attendance.reminder', 'employee');
select pg_temp.sub_relation('attendance.open_session_detected', 'employee', array['in_app','email']);
select pg_temp.sub_relation('attendance.open_session_detected', 'manager_of_assignee');
select pg_temp.sub_relation('attendance.correction_approved', 'employee');
select pg_temp.sub_relation('attendance.correction_rejected', 'employee');
select pg_temp.sub_relation('leave.approved', 'employee', array['in_app','email']);
select pg_temp.sub_relation('leave.rejected', 'employee', array['in_app','email']);
select pg_temp.sub_relation('overtime.decided', 'employee');
select pg_temp.sub_relation('commission.eligible', 'employee');
select pg_temp.sub_relation('commission.approved', 'employee', array['in_app','email']);
select pg_temp.sub_relation('commission.paid', 'employee');
select pg_temp.sub_relation('change_request.created', 'pm', array['in_app','email']);
select pg_temp.sub_relation('change_request.approved', 'pm');
select pg_temp.sub_relation('access.granted', 'employee');
select pg_temp.sub_relation('access.revoked', 'employee');
select pg_temp.sub_relation('device.assigned', 'employee');
select pg_temp.sub_relation('onboarding.started', 'employee');
select pg_temp.sub_role('onboarding.completed', 'hr');
select pg_temp.sub_relation('employee.lifecycle_changed', 'employee');
select pg_temp.sub_role('automation.failed', 'admin');
select pg_temp.sub_relation('security.mfa_required', 'employee', array['in_app','email'], false);
select pg_temp.sub_relation('file.shared', 'assignee');
select pg_temp.sub_relation('client.assigned', 'account_manager');
select pg_temp.sub_relation('lead.unassigned_owner_inactive', 'manager_of_actor');

-- ---------------------------------------------------------------------------
-- Bootstrap: every existing staff auth user becomes an employee with the
-- Super Admin role so nobody loses the access they had under the old
-- "any non-proposal-client user is admin" rule (lib/auth.ts).
-- ---------------------------------------------------------------------------

insert into employees (user_id, full_name, email, lifecycle_status, work_schedule_id, start_date)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
       u.email,
       'active',
       (select id from work_schedules where is_default),
       (u.created_at at time zone 'UTC')::date
from auth.users u
where coalesce(u.raw_app_meta_data->>'role', '') not in ('proposal_client', 'client')
on conflict (user_id) do nothing;

insert into user_roles (user_id, role_id)
select e.user_id, r.id
from employees e
cross join roles r
where r.key = 'super_admin' and e.user_id is not null
on conflict do nothing;

update document_sequences
   set next_value = greatest(next_value, (select count(*) + 1 from employees))
 where key = 'employee';

update employees
   set employee_code = 'EMP-' || lpad(rn::text, 4, '0')
  from (select id, row_number() over (order by created_at) as rn from employees) s
 where employees.id = s.id and employees.employee_code is null;
