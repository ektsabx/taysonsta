-- Owner request (2026-10-07): Pro is $50 a month (was $20); Free and Growth
-- ($100) unchanged. Pricing as a whole is still open (docs/18).
update public.plan_quotas set price_usd = 50, updated_by = 'owner request 2026-10-07', updated_at = now() where plan = 'pro';
