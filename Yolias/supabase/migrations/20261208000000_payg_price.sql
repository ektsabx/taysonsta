-- Pay As You Go costs more than a plan (owner, 2026-10-31, D-270): the top-up
-- amounts stay ($5 / $20 / $50 / $100, "from $5" stays true) and buy half as
-- many prospects: $0.10 each against $0.05 on Pro and Growth, so a plan is the
-- better deal for anyone who keeps using Yolias. Prospects already bought keep
-- their balance; past top-ups and ledger rows are untouched. Editable later in
-- Yolias Admin like any price.

update public.site_settings
set value = jsonb_set(coalesce(value, '{}'::jsonb), '{usd_per_prospect}', to_jsonb(0.10))
where key = 'credits';

update public.prospect_packs set active = false, updated_by = 'D-270', updated_at = now() where active;
insert into public.prospect_packs (prospects, emails, price_usd, active, sort, updated_by) values
  (50, 0, 5, true, 1, 'D-270'),
  (200, 0, 20, true, 2, 'D-270'),
  (500, 0, 50, true, 3, 'D-270'),
  (1000, 0, 100, true, 4, 'D-270');
