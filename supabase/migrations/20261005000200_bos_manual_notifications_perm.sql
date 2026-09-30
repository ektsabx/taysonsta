-- Master upgrade Phase 6 (docs/bos/30 §9.4): HR and executives send manual
-- notifications (announcements) to staff; admins already can.
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from roles r join permissions p on p.key = 'notifications.manage'
where r.key in ('hr', 'executive')
on conflict (role_id, permission_id) do nothing;
