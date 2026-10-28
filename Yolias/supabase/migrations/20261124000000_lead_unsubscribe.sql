-- Unsubscribe link in campaign emails (owner, 2026-10-28). Each lead gets a
-- random token; the link in every campaign email (and the List-Unsubscribe
-- header, RFC 8058 one-click) carries it, never the lead id. Using it marks the
-- lead "do not contact" and stops its campaigns. The token can only do that
-- one thing, so it follows the table's existing RLS like any lead column.

alter table public.sales_leads
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists sales_leads_unsubscribe_token_key on public.sales_leads (unsubscribe_token);

alter table public.sales_leads
  add column if not exists unsubscribed_at timestamptz;
