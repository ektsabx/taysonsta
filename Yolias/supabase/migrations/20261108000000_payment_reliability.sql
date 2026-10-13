-- Payment reliability (2026-10-12).
-- 1. Fulfilment (start the plan / grant the pack) is tracked apart from the
--    payment status, so a fulfilment that failed after the status moved to
--    `succeeded` is retried by the next signed callback instead of being lost.
--    `fulfil_claimed_at` is a short claim so two callbacks never fulfil at once.
-- 2. `checkout_url` keeps the provider's hosted checkout link of a pending
--    payment, so a second click (or coming back from the provider) reuses the
--    same checkout instead of opening a new one.
-- 3. A prospect pack is granted once per payment, enforced by the database.
-- Additive only: no data is removed.

alter table public.payments
  add column if not exists fulfilled_at timestamptz,
  add column if not exists fulfil_claimed_at timestamptz,
  add column if not exists checkout_url text;

-- Payments settled before this migration were fulfilled by the old code path.
update public.payments
   set fulfilled_at = coalesce(paid_at, updated_at)
 where status in ('succeeded', 'refunded') and fulfilled_at is null;

-- A finished payment no longer needs its checkout link.
update public.payments set checkout_url = null where status <> 'pending' and checkout_url is not null;

create index if not exists payments_pending_reuse_idx
  on public.payments (workspace_id, created_by, created_at desc)
  where status = 'pending';

create unique index if not exists usage_ledger_pack_grant_uq
  on public.usage_ledger (reason)
  where kind = 'grant' and reason like 'prospect_pack:%' and reason <> 'prospect_pack:test';
