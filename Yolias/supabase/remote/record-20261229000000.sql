insert into supabase_migrations.schema_migrations (version,name,statements) values ('20261229000000','meeting_guest_locale','{}') on conflict (version) do nothing;
