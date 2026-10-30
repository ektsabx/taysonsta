insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261205000000', 'email_only', '{}')
on conflict (version) do nothing;
