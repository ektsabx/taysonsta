-- Master upgrade Phase 6 (docs/bos/30 §9, §18, §20; doc 31).
-- Notifications: per-language templates, priority, subscription conditions,
-- real delivery with retry, manual sends. Approvals: parallel steps,
-- request changes / resubmit, due dates + reminders, delegation.

alter type approval_status add value if not exists 'changes_requested';

-- ------------------------------------------------------------ approvals
alter table approvals
  add column if not exists due_at timestamptz,
  add column if not exists reminded_at timestamptz,
  add column if not exists delegated_from uuid references auth.users(id) on delete set null;
create index if not exists approvals_pending_due_idx on approvals (due_at) where status = 'pending';
create index if not exists approvals_group_step_idx on approvals (group_id, step);

-- Delegation / substitute approver: while active, new approvals for the
-- delegator go to the delegate, and the delegate may decide open ones.
create table approval_delegations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delegate_user_id uuid not null references auth.users(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  approval_types text[] not null default '{}',   -- empty = all types
  reason text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (user_id <> delegate_user_id)
);
create index approval_delegations_user_idx on approval_delegations (user_id, starts_on, ends_on) where is_active;

-- ------------------------------------------------------------ notifications
alter table notifications add column if not exists priority text not null default 'normal' check (priority in ('low','normal','high','urgent'));
alter table notification_subscriptions add column if not exists conditions jsonb not null default '[]'::jsonb;
alter table notification_deliveries
  add column if not exists next_attempt_at timestamptz,
  add column if not exists provider_message_id text,
  add column if not exists recipient text;

create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  language text not null check (language in ('ar','en')),
  title text not null,
  body text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  is_active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (event_type, language)
);
create trigger notification_templates_touch before update on notification_templates for each row execute function bos_touch_updated_at();

-- Manual sends (to employees / teams / departments / branches / roles).
create table manual_notifications (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete set null,
  target_kind text not null check (target_kind in ('users','team','department','branch','role','all')),
  target_ids uuid[] not null default '{}',
  channels text[] not null default '{in_app}',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  title text not null,
  body text,
  link text,
  recipient_count int not null default 0,
  content_hash text not null,
  created_at timestamptz not null default now()
);
create index manual_notifications_dup_idx on manual_notifications (sender_id, content_hash, created_at desc);

alter table approval_delegations enable row level security;
alter table notification_templates enable row level security;
alter table manual_notifications enable row level security;
grant all on approval_delegations, notification_templates, manual_notifications to service_role;

-- Default notification titles (Arabic + English) for the events the
-- spec lists (§9.1). Variables: {{entity.*}} from the record when known,
-- {{payload.*}} from the event, {{summary}} the event's own summary.
insert into notification_templates (event_type, language, title, body, priority) values
  ('lead.created', 'ar', 'عميل محتمل جديد: {{entity.name}}', '{{entity.company_name}}', 'normal'),
  ('lead.created', 'en', 'New lead: {{entity.name}}', '{{entity.company_name}}', 'normal'),
  ('lead.assigned', 'ar', 'أُسند إليك عميل محتمل: {{entity.name}}', null, 'high'),
  ('lead.assigned', 'en', 'Lead assigned to you: {{entity.name}}', null, 'high'),
  ('deal.updated', 'ar', 'تحديث على الصفقة: {{entity.name}}', '{{summary}}', 'normal'),
  ('deal.updated', 'en', 'Deal updated: {{entity.name}}', '{{summary}}', 'normal'),
  ('deal.stage_changed', 'ar', 'الصفقة {{entity.name}} انتقلت لمرحلة جديدة', null, 'normal'),
  ('deal.stage_changed', 'en', 'Deal {{entity.name}} moved to a new stage', null, 'normal'),
  ('deal.won', 'ar', '🎉 صفقة مكسوبة: {{entity.name}}', null, 'high'),
  ('deal.won', 'en', '🎉 Deal won: {{entity.name}}', null, 'high'),
  ('task.assigned', 'ar', 'مهمة جديدة لك: {{entity.title}}', null, 'normal'),
  ('task.assigned', 'en', 'New task for you: {{entity.title}}', null, 'normal'),
  ('invoice.sent', 'ar', 'صدرت الفاتورة {{entity.invoice_number}}', null, 'normal'),
  ('invoice.sent', 'en', 'Invoice {{entity.invoice_number}} issued', null, 'normal'),
  ('invoice.paid', 'ar', 'تم سداد الفاتورة {{entity.invoice_number}}', null, 'normal'),
  ('invoice.paid', 'en', 'Invoice {{entity.invoice_number}} paid', null, 'normal'),
  ('invoice.overdue', 'ar', 'فاتورة متأخرة: {{entity.invoice_number}}', null, 'high'),
  ('invoice.overdue', 'en', 'Overdue invoice: {{entity.invoice_number}}', null, 'high'),
  ('contract.signed', 'ar', 'تم توقيع العقد {{entity.contract_number}}', '{{entity.title}}', 'high'),
  ('contract.signed', 'en', 'Contract {{entity.contract_number}} signed', '{{entity.title}}', 'high'),
  ('approval.requested', 'ar', 'مطلوب موافقتك: {{payload.title}}', null, 'high'),
  ('approval.requested', 'en', 'Your approval is needed: {{payload.title}}', null, 'high'),
  ('approval.decided', 'ar', 'قرار على طلبك: {{payload.title}}', '{{payload.comment}}', 'normal'),
  ('approval.decided', 'en', 'Decision on your request: {{payload.title}}', '{{payload.comment}}', 'normal'),
  ('approval.changes_requested', 'ar', 'مطلوب تعديلات على: {{payload.title}}', '{{payload.comment}}', 'high'),
  ('approval.changes_requested', 'en', 'Changes requested on: {{payload.title}}', '{{payload.comment}}', 'high'),
  ('approval.overdue', 'ar', 'موافقة متأخرة: {{payload.title}}', null, 'urgent'),
  ('approval.overdue', 'en', 'Overdue approval: {{payload.title}}', null, 'urgent'),
  ('leave.requested', 'ar', 'طلب إجازة جديد', '{{summary}}', 'normal'),
  ('leave.requested', 'en', 'New leave request', '{{summary}}', 'normal'),
  ('ticket.created', 'ar', 'تذكرة دعم جديدة: {{entity.subject}}', null, 'high'),
  ('ticket.created', 'en', 'New support ticket: {{entity.subject}}', null, 'high'),
  ('ticket.client_replied', 'ar', 'رد جديد من العميل على التذكرة {{entity.ticket_number}}', null, 'high'),
  ('ticket.client_replied', 'en', 'New client reply on ticket {{entity.ticket_number}}', null, 'high'),
  ('chat.client_message', 'ar', 'رسالة جديدة من العميل', '{{summary}}', 'high'),
  ('chat.client_message', 'en', 'New message from a client', '{{summary}}', 'high'),
  ('chat.mentioned', 'ar', 'تمت الإشارة إليك', '{{summary}}', 'normal'),
  ('chat.mentioned', 'en', 'You were mentioned', '{{summary}}', 'normal'),
  ('project.delayed', 'ar', 'المشروع {{entity.name}} متأخر', null, 'high'),
  ('project.delayed', 'en', 'Project {{entity.name}} is delayed', null, 'high'),
  ('milestone.overdue', 'ar', 'مرحلة متأخرة: {{entity.name}}', null, 'high'),
  ('milestone.overdue', 'en', 'Overdue milestone: {{entity.name}}', null, 'high'),
  ('employee_document.expiring', 'ar', 'مستند قارب على الانتهاء', '{{summary}}', 'normal'),
  ('employee_document.expiring', 'en', 'Document expiring soon', '{{summary}}', 'normal'),
  ('integration.failed', 'ar', 'فشل تكامل: {{payload.provider}}', '{{payload.error}}', 'urgent'),
  ('integration.failed', 'en', 'Integration failure: {{payload.provider}}', '{{payload.error}}', 'urgent'),
  ('security.alert', 'ar', 'تنبيه أمني', '{{summary}}', 'urgent'),
  ('security.alert', 'en', 'Security alert', '{{summary}}', 'urgent'),
  ('user.invited', 'ar', 'تمت دعوة {{payload.name}} للنظام', null, 'low'),
  ('user.invited', 'en', '{{payload.name}} was invited to the system', null, 'low')
on conflict (event_type, language) do nothing;

-- Default subscriptions for the new events.
insert into notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
select 'approval.changes_requested', 'relation', 'creator', '{in_app,email}', false
where not exists (select 1 from notification_subscriptions where event_type = 'approval.changes_requested');
insert into notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
select 'approval.overdue', 'relation', 'approver', '{in_app,email}', false
where not exists (select 1 from notification_subscriptions where event_type = 'approval.overdue');
insert into notification_subscriptions (event_type, subscriber_kind, role_id, channels, user_configurable)
select 'integration.failed', 'role', r.id, '{in_app,email}', false from roles r
where r.key = 'admin' and not exists (select 1 from notification_subscriptions where event_type = 'integration.failed');
