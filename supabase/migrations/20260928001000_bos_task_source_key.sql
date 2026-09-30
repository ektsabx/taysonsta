-- Automation-created tasks carry an idempotency key in a dedicated column
-- (rule + event), so re-dispatching an event can never create duplicates.
alter table tasks add column source_key text;
create unique index tasks_source_key_idx on tasks (source_key) where source_key is not null;
