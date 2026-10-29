insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261128000000', 'brand_spelling', '{}')
on conflict (version) do nothing;
