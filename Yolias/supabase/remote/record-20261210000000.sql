insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261210000000', 'sales_agent', '{}')
on conflict (version) do nothing;
