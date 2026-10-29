-- The Arabic brand name without the tatweel (owner, 2026-10-29, D-265):
-- «يولياس», the way people type it in a search, instead of «يولـياس».
-- Rewrites the stored website content and the status page; nothing else.
update public.content_entries
set doc = replace(doc::text, 'يولـياس', 'يولياس')::jsonb,
    meta = replace(meta::text, 'يولـياس', 'يولياس')::jsonb,
    seo = replace(seo::text, 'يولـياس', 'يولياس')::jsonb
where doc::text like '%يولـياس%' or meta::text like '%يولـياس%' or seo::text like '%يولـياس%';

update public.status_components
set name_ar = replace(name_ar, 'يولـياس', 'يولياس'),
    description_ar = replace(description_ar, 'يولـياس', 'يولياس')
where name_ar like '%يولـياس%' or description_ar like '%يولـياس%';
