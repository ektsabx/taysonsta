insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261211000000', 'results_engine', '{}')
on conflict (version) do nothing;
