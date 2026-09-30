-- UI/system review (docs/bos/35 B14a): clients follow their project tasks in
-- the portal. Internal by default — only tasks explicitly marked are shown.
alter table tasks add column if not exists client_visible boolean not null default false;
create index if not exists tasks_client_visible_idx on tasks (project_id) where client_visible and archived_at is null;
