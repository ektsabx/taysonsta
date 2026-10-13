-- 2026-10-13: these two were recorded although they failed on production
-- (the shared database already has the Admin's leads / meetings tables).
-- Remove the records, apply the fixed files, then record them again.
delete from supabase_migrations.schema_migrations where version in ('20261111000000', '20261112000000');
