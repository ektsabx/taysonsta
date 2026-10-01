-- Yolias Admin: permissions for the Yolias platform modules
-- (docs/09-yolias-admin.md §B). platform.read = see users, workspaces,
-- searches and platform metrics; platform.manage = change them (later phases).

insert into permissions (key, module, action, description)
select 'platform.' || a::text, 'platform', a, 'Yolias platform — ' || replace(a::text, '_', ' ')
from unnest(enum_range(null::permission_action)) as a
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'::permission_scope
from roles r join permissions p on p.module = 'platform'
where r.key in ('super_admin', 'admin')
   or (r.key = 'executive' and p.action::text in ('read', 'export', 'view_sensitive'))
on conflict (role_id, permission_id) do nothing;
