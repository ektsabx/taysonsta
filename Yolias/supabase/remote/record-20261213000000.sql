insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261213000000', 'roles', '{}')
on conflict (version) do nothing;
