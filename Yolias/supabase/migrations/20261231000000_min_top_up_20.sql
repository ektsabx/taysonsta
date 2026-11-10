-- The smallest top-up is $20 (owner, 2026-11-10): packs under $20 are no
-- longer offered. Credit already bought stays; nothing else changes.
update public.prospect_packs set active = false where active and price_usd < 20;
