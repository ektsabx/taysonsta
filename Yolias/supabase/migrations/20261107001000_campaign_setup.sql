-- Campaign Setup before the search starts (owner decision 2026-10-07, D-167):
-- Yolias AI turns the request into structured criteria, the member reviews and
-- completes them, and only then does the campaign start. "setup" = waiting
-- for that confirmation.
alter table public.strategies drop constraint strategies_status_check;
alter table public.strategies add constraint strategies_status_check check (status in ('understanding', 'setup', 'ready', 'failed'));
