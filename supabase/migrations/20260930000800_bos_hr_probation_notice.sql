-- Probation ending reminder goes to the manager and HR.
insert into notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
select 'employee.probation_ending', 'relation', 'assignee', array['in_app','email'], true
where not exists (select 1 from notification_subscriptions where event_type = 'employee.probation_ending' and relation = 'assignee');
insert into notification_subscriptions (event_type, subscriber_kind, role_id, channels, user_configurable)
select 'employee.probation_ending', 'role', r.id, array['in_app'], true from roles r
where r.key = 'hr' and not exists (select 1 from notification_subscriptions s where s.event_type = 'employee.probation_ending' and s.role_id = r.id);
