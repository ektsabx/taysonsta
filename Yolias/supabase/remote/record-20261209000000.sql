insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261209000000', 'ads_manager', '{}')
on conflict (version) do nothing;
