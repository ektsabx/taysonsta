insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261126000000', 'deals_and_meetings', '{}')
on conflict (version) do nothing;
