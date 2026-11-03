insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261218000000', 'geo_tracking', '{}')
on conflict (version) do nothing;
