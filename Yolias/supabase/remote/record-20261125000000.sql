insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261125000000', 'referral_program', '{}')
on conflict (version) do nothing;
