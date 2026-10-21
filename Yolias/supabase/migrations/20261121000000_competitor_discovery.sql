-- Competitor discovery (owner brief 2026-10-21, D-251). Competitors can now be
-- found by Yolias AI (Gemini grounded in Google Search) as well as added by
-- hand. Each found one keeps where it came from and how sure Yolias is; its
-- website was opened before it was saved. Existing rows are manual.
alter table public.competitors
  add column kind text check (kind in ('direct', 'indirect')),
  add column source text not null default 'manual' check (source in ('manual', 'ai_research')),
  add column source_url text check (source_url is null or length(source_url) <= 1000),
  add column confidence text check (confidence in ('high', 'medium')),
  add column discovered_at timestamptz,
  add column verified_at timestamptz;
