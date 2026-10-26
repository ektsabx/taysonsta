insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261122000000', 'email_sending_rules', '{}')
on conflict (version) do nothing;
