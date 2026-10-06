-- Owner decisions (2026-10-06, D-142, D-143):
-- 1) Prices stay in USD everywhere; Paymob's card integration converts the
--    USD amount to the card's EGP charge by itself. When its callback
--    reports the converted charge, the payment records it here.
-- 2) Buy More Prospects (like "extra usage"): default packs on sale.

alter table public.payments
  add column charge_amount numeric(12, 2) check (charge_amount is null or charge_amount > 0),
  add column charge_currency text check (charge_currency is null or charge_currency in ('USD', 'EGP')),
  add column fx_rate numeric(12, 4) check (fx_rate is null or fx_rate > 0);

comment on column public.payments.amount is 'Price in USD (what the invoice shows).';
comment on column public.payments.charge_amount is 'What the provider reported charging, in charge_currency (EGP when Paymob converted it).';
comment on column public.payments.fx_rate is 'charge_amount / amount (the provider''s conversion).';

-- Default packs (editable later in Yolias Admin). Priced above the plans'
-- per-prospect price so upgrading stays the better deal.
insert into public.prospect_packs (prospects, price_usd, active, sort, updated_by)
select * from (values (250, 10.00, true, 1, 'owner decision D-143'), (1000, 30.00, true, 2, 'owner decision D-143'), (3000, 75.00, true, 3, 'owner decision D-143')) v
where not exists (select 1 from public.prospect_packs);
