insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261225000000', 'app_listings_bucket', '{}') on conflict (version) do nothing;
