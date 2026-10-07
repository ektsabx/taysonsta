-- Owner decision 2026-10-07 (D-165): every delivered result is in Prospects.
-- New deliveries set saved_at in the pipeline; this puts earlier results there too.
update public.companies set saved_at = coalesce(delivered_at, created_at) where delivered_at is not null and saved_at is null;
update public.prospects set saved_at = created_at where saved_at is null;
