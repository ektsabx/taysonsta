-- D-275 (owner, 2026-11-02): a pixel's website, asked when it is created
-- (like Facebook's and TikTok's "Create pixel"), shown on its card and used
-- to open the website in Test events.
alter table public.pixels
  add column if not exists website_url text check (website_url is null or char_length(website_url) <= 300);
