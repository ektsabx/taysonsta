-- D-147: richer results (owner's reference: logo, brief, LinkedIn, founded,
-- photos of decision makers). Filled from the data provider when it has
-- them; the app falls back to a domain icon / initials.
alter table public.companies
  add column logo_url text check (logo_url is null or logo_url ~* '^https://'),
  add column linkedin_url text check (linkedin_url is null or linkedin_url ~* '^https://'),
  add column founded_year int check (founded_year is null or founded_year between 1800 and 2100);
alter table public.prospects
  add column photo_url text check (photo_url is null or photo_url ~* '^https://');
