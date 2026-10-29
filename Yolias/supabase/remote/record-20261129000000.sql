insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261129000000', 'retire_discovery_post', '{}')
on conflict (version) do nothing;
