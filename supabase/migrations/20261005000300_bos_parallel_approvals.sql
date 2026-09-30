-- Master upgrade Phase 6 (docs/bos/30 §18): a parallel step has several
-- approvals with the same (group, step) — one per approver.
alter table approvals drop constraint if exists approvals_group_id_step_key;
create unique index if not exists approvals_group_step_approver_idx
  on approvals (group_id, step, coalesce(approver_user_id::text, ''), coalesce(approver_role_id::text, ''), coalesce(approver_contact_id::text, ''))
  where group_id is not null;
