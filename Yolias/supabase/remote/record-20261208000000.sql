insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261208000000', 'payg_price', '{}')
on conflict (version) do nothing;
