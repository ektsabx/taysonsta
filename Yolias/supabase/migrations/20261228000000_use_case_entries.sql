-- Use cases are edited in Yolias Admin (owner, 2026-11-05).
alter table public.content_entries drop constraint if exists content_entries_kind_check;
alter table public.content_entries add constraint content_entries_kind_check check (kind = any (array['help','docs','blog','legal','compare','alternatives','solution','template','use_case']));
