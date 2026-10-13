-- Yolias Admin → Affiliates (2026-10-12, D-178). Separate permissions so the
-- work can be split between people:
--   affiliates.read            overview, lists and reports (read only)
--   affiliates.approve         review applications; suspend / reactivate affiliates
--   affiliates.update          review commissions (hold, release, approve, reject, reverse, adjust)
--   affiliates.manage          program settings and terms
--   affiliates.view_sensitive  payout details and the referred accounts' emails
--   affiliate_payouts.approve  review payouts and record them as sent
-- The audit trail is visible with affiliates.read; the Admin audit log keeps
-- its own audit.read permission.

insert into permissions (key, module, action, description) values
  ('affiliates.read', 'affiliates', 'read', 'Yolias affiliates — read'),
  ('affiliates.approve', 'affiliates', 'approve', 'Yolias affiliates — review applications and affiliate status'),
  ('affiliates.update', 'affiliates', 'update', 'Yolias affiliates — review commissions'),
  ('affiliates.manage', 'affiliates', 'manage', 'Yolias affiliates — program settings'),
  ('affiliates.view_sensitive', 'affiliates', 'view_sensitive', 'Yolias affiliates — payout details and referred customers'),
  ('affiliate_payouts.approve', 'affiliate_payouts', 'approve', 'Yolias affiliate payouts — review and record payouts')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'::permission_scope
from roles r join permissions p on p.module in ('affiliates', 'affiliate_payouts')
where r.key in ('super_admin', 'admin')
   or (r.key = 'executive' and p.key = 'affiliates.read')
   or (r.key = 'finance' and p.key in ('affiliates.read', 'affiliates.view_sensitive', 'affiliate_payouts.approve'))
on conflict (role_id, permission_id) do nothing;
