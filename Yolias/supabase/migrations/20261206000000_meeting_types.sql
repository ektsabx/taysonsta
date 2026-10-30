-- Meeting types (owner, 2026-10-30, D-269): besides the page's own meeting,
-- up to three more (for example a 15-minute intro and a 45-minute demo), each
-- with its name, length and a line for visitors. The guest picks one.
alter table public.booking_pages
  add column if not exists types jsonb not null default '[]'::jsonb check (jsonb_typeof(types) = 'array' and jsonb_array_length(types) <= 3);
