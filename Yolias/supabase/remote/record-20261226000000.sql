insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261226000000', 'email_links', '{}') on conflict (version) do nothing;
