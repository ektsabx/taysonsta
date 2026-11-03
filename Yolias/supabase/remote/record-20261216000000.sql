insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261216000000', 'admin_metrics', '{}')
on conflict (version) do nothing;
