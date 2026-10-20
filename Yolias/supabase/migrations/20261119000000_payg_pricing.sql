-- Pricing: Pay As You Go + two monthly plans (owner brief 2026-10-20, D-247).
--   Pay As You Go  prepaid credit bought in $5 / $20 / $50 / $100 top-ups;
--                  a top-up never starts a subscription and never renews.
--   Pro   $50 / month, Growth $100 / month (names kept); no annual, no Scale.
-- One unit: the prospect. Emails are not counted or limited any more (the
-- member sends from their own mailbox), uploaded contacts are not limited.
-- Nothing is deleted: existing subscriptions (annual or Scale) keep running
-- as they are, past payments and ledger rows stay.

-- A workspace that bought credit can use Yolias without a subscription.
alter table public.workspaces add column credit_started_at timestamptz;

-- The price of one prospect, the only rate top-ups are converted with.
insert into public.site_settings (key, value) values ('credits', jsonb_build_object('usd_per_prospect', 0.05))
on conflict (key) do nothing;

-- Top-up options: the old "buy more" packs are retired (kept for history) and
-- replaced by the four amounts at the same $0.05 rate.
update public.prospect_packs set active = false, updated_by = 'D-247', updated_at = now() where active;
insert into public.prospect_packs (prospects, emails, price_usd, active, sort, updated_by) values
  (100, 0, 5, true, 1, 'D-247'),
  (400, 0, 20, true, 2, 'D-247'),
  (1000, 0, 50, true, 3, 'D-247'),
  (2000, 0, 100, true, 4, 'D-247');

-- No free credit: the legacy Free plan gives nothing. Contacts are unlimited.
update public.plan_quotas set prospects_per_month = 0, updated_by = 'D-247', updated_at = now() where plan = 'free';
update public.plan_quotas set contacts_per_month = 1000000, emails_per_month = 1000000, updated_by = 'D-247', updated_at = now();

-- Emails were limited per month by this trigger; they no longer are.
drop trigger if exists outreach_email_limit on public.outreach_messages;

