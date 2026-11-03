insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261221000000', 'admin_ops', '{}')
on conflict (version) do nothing;
