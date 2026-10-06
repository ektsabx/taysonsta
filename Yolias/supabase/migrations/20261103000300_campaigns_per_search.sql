-- A search is one conversation (D-133): a campaign Yolias AI starts from
-- inside a search's conversation belongs to that search, so a search can now
-- have several campaigns. Its own campaign is the first one (created_at).
alter table public.campaigns drop constraint if exists campaigns_strategy_id_key;
create index if not exists campaigns_strategy_idx on public.campaigns (strategy_id, created_at);
