-- D-278 (owner, 2026-11-03): Yolias members are data for other campaigns.
-- Each workspace's business (name, website, industry, country) and its
-- owner (name, login email) feed a system dataset that discovery searches
-- like any customer-facing dataset; a campaign targeting real estate reaches
-- a real estate company that uses Yolias. A workspace can leave the
-- directory (Settings → Organization); the next daily rebuild removes it.
alter table public.workspaces add column if not exists listed_in_directory boolean not null default true;
