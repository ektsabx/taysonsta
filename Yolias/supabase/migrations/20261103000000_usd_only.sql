-- D-131: one USD price for every country, Egypt included. The EGP price
-- columns and the EGP currency option are removed.

update public.workspaces set billing_currency = 'USD' where billing_currency <> 'USD';
update public.invoices set currency = 'USD' where currency <> 'USD';
update public.payments set currency = 'USD' where currency <> 'USD';
update public.subscription_events set currency = 'USD' where currency <> 'USD';

alter table public.plan_quotas drop column price_egp;
alter table public.prospect_packs drop column price_egp;

alter table public.workspaces drop constraint workspaces_billing_currency_check,
  add constraint workspaces_billing_currency_check check (billing_currency = 'USD');
alter table public.invoices drop constraint invoices_currency_check,
  add constraint invoices_currency_check check (currency = 'USD');
alter table public.payments drop constraint payments_currency_check,
  add constraint payments_currency_check check (currency = 'USD');
alter table public.subscription_events drop constraint subscription_events_currency_check,
  add constraint subscription_events_currency_check check (currency = 'USD');

-- Paymob takes payments through its USD integration ids only.
update public.payment_providers
set config = jsonb_set(config, '{integrations}', jsonb_build_object('USD', coalesce(config #> '{integrations,USD}', '[]'::jsonb)))
where id = 'paymob';
