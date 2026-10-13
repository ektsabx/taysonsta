insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261113000000', 'conversion_tracking', '{}')
on conflict (version) do nothing;
