insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261107001000', 'campaign_setup', '{}')
on conflict (version) do nothing;
