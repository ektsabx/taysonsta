insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261215000000', 'site_visits', '{}')
on conflict (version) do nothing;
