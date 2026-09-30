-- Notification subscriptions for Team / IT events added in Phase 5
-- (docs/bos/12, 13, 24, 27). Configurable in Settings → Notifications.

insert into notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
select * from (values
  ('leave.requested', 'relation', 'manager_of_assignee', array['in_app','email'], true),
  ('review.submitted', 'relation', 'employee', array['in_app','email'], true),
  ('access.request_approved', 'relation', 'creator', array['in_app'], true),
  ('access.request_approved', 'relation', 'employee', array['in_app'], true),
  ('access.request_approved', 'relation', 'assignee', array['in_app','email'], true),
  ('access.request_rejected', 'relation', 'creator', array['in_app'], true),
  ('access.request_rejected', 'relation', 'employee', array['in_app'], true),
  ('access.expired', 'relation', 'employee', array['in_app'], true),
  ('employee.manager_changed', 'relation', 'employee', array['in_app'], true)
) as v(event_type, subscriber_kind, relation, channels, user_configurable)
where not exists (select 1 from notification_subscriptions s where s.event_type = v.event_type and s.relation = v.relation);

insert into notification_subscriptions (event_type, subscriber_kind, role_id, channels, user_configurable)
select v.event_type, 'role', r.id, v.channels, true
from (values
  ('employee.reports_need_reassignment', 'hr', array['in_app']),
  ('offboarding.completed', 'hr', array['in_app']),
  ('offboarding.completed', 'admin', array['in_app']),
  ('employee.created', 'hr', array['in_app']),
  ('access.expired', 'admin', array['in_app'])
) as v(event_type, role_key, channels)
join roles r on r.key = v.role_key
where not exists (select 1 from notification_subscriptions s where s.event_type = v.event_type and s.role_id = r.id);
