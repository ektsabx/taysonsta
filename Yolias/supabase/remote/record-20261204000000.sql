insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261204000000', 'ab_test', '{}')
on conflict (version) do nothing;
