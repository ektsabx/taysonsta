insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261228000000', 'use_case_entries', '{}') on conflict (version) do nothing;
