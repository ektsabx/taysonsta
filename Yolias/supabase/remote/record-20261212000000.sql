insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261212000000', 'pixel_website', '{}')
on conflict (version) do nothing;
