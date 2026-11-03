insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261222000000', 'admin_ops_cost', '{}')
on conflict (version) do nothing;
