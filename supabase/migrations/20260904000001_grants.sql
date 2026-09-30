grant usage on schema public to anon, authenticated, service_role;

grant select on public.blog_categories to anon, authenticated;
grant select on public.authors to anon, authenticated;
grant select on public.blogs to anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant select on public.portfolio_projects to anon, authenticated;
grant select on public.faqs to anon, authenticated;
grant select on public.availability_rules to anon, authenticated;
grant select on public.bookings to anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
