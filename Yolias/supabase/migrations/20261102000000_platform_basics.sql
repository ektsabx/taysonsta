-- Final spec phase 2: currency rule (Egypt → EGP, every other country → USD,
-- no conversion, D-120 for Yolias). Each plan gets its own EGP price, set in
-- Yolias Admin; null = not priced in EGP yet. A workspace is billed in one
-- currency, fixed from its country when it first picks a plan.

alter table public.plan_quotas
  add column price_egp numeric(12, 2) check (price_egp is null or price_egp >= 0);

update public.plan_quotas set price_egp = 0 where plan = 'free';

alter table public.workspaces
  add column billing_currency text not null default 'USD' check (billing_currency in ('USD', 'EGP')),
  add column billing_country text check (billing_country is null or billing_country ~ '^[A-Z]{2}$');
