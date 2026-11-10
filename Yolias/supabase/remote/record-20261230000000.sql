insert into supabase_migrations.schema_migrations (version,name,statements) values ('20261230000000','team_invite_accept','{}') on conflict (version) do nothing;
