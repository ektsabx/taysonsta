-- Saved cards on Paymob (owner 2026-10-21, D-254): Kashier's renewals from a
-- saved card move to Paymob. Additive: the provider check also allows
-- 'paymob'; existing rows are untouched.
alter table public.billing_cards drop constraint if exists billing_cards_provider_check;
alter table public.billing_cards add constraint billing_cards_provider_check check (provider in ('kashier', 'paymob'));
