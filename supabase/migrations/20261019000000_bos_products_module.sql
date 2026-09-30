-- UI/system review (docs/bos/35 A7): Products & services become a standalone
-- module with its own permissions instead of living under settings.manage.
-- Additive only: existing products/project_templates data is untouched.

insert into permissions (key, module, action, description)
select 'products.' || a::text, 'products', a, 'Products — ' || replace(a::text, '_', ' ')
from unnest(enum_range(null::permission_action)) as a
on conflict (key) do nothing;

-- Super Admin and Admin manage the catalogue.
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'::permission_scope
from roles r join permissions p on p.module = 'products'
where r.key in ('super_admin', 'admin')
on conflict (role_id, permission_id) do nothing;

-- Anyone who sells, invoices or delivers can read the catalogue (prices are
-- already visible to them on proposals, invoices and projects).
insert into role_permissions (role_id, permission_id, scope)
select distinct rp.role_id, p.id, 'all'::permission_scope
from role_permissions rp
join permissions src on src.id = rp.permission_id and src.key in ('deals.read', 'proposals.read', 'invoices.read', 'projects.read')
join permissions p on p.key = 'products.read'
on conflict (role_id, permission_id) do nothing;

-- Whoever could edit products through settings keeps that ability.
insert into role_permissions (role_id, permission_id, scope)
select distinct rp.role_id, p.id, 'all'::permission_scope
from role_permissions rp
join permissions src on src.id = rp.permission_id and src.key = 'settings.manage' and rp.scope = 'all'
join permissions p on p.module = 'products'
on conflict (role_id, permission_id) do nothing;
