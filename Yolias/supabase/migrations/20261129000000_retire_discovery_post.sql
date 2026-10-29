-- "Why Yolias stops at discovery" said Yolias doesn't send messages; it does
-- now (campaigns from the member's mailbox), so the post is retired (D-266)
-- and its URL moves to the product page, in both languages.
delete from public.content_entries where kind = 'blog' and slug = 'why-yolias-stops-at-discovery';
insert into public.seo_redirects (from_path, to_path, status_code, note, created_by)
values ('/blog/why-yolias-stops-at-discovery', '/product', 308, 'Retired: the product sends campaigns now (D-266)', 'migration')
on conflict (from_path) do nothing;
