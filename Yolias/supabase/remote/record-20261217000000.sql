insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261217000000', 'onboarding_answers', '{}')
on conflict (version) do nothing;
