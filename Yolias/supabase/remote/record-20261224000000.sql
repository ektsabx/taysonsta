insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261224000000', 'fast_reads', '{}') on conflict (version) do nothing;
