-- Owner decisions 2026-10-07 (D-164):
-- 1) One prospect = one qualifying company. Pro $50 = 1,000, Growth $100 = 2,000.
-- 2) Extra prospects cost the same per prospect as the plans ($0.05): no
--    discount and no markup.
-- 3) Until Foursquare OS Places is connected, discovery runs on the website
--    adapter (lib/intel/adapters/web-discovery.ts): the model proposes
--    businesses, and only what each business's own website publishes is kept.

update public.plan_quotas set prospects_per_month = 1000, updated_by = 'owner decision D-164', updated_at = now() where plan = 'pro';
update public.plan_quotas set prospects_per_month = 2000, updated_by = 'owner decision D-164', updated_at = now() where plan = 'growth';

update public.prospect_packs set price_usd = round(prospects * 0.05, 2), updated_by = 'owner decision D-164', updated_at = now();

insert into intel.providers (id, name, enabled, priority, capabilities, pricing, license_scope, storage_allowed,
  display_allowed, customer_facing_allowed, redistribution_allowed, derived_data_allowed, notes)
values ('yolias_web', 'Company websites (Yolias AI)', true, 900, array['company.search', 'place.search'],
  '{"company.search": {"unit": "request", "unit_cost_usd": 0}, "place.search": {"unit": "request", "unit_cost_usd": 0}}',
  'Public contact details from each business''s own website', true, true, true, true, true,
  'D-164: AI proposes candidates; only websites that answer with an email, phone or WhatsApp are kept. Model cost is logged in intel.llm_calls.')
on conflict (id) do update set enabled = true, storage_allowed = true, display_allowed = true, customer_facing_allowed = true,
  redistribution_allowed = true, derived_data_allowed = true, priority = excluded.priority, capabilities = excluded.capabilities, notes = excluded.notes;
