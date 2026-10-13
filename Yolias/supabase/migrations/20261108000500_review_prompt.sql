-- Trustpilot review request (2026-10-12): shown once per user, after their
-- first search delivered results, on whichever device they use next. The
-- state lives on the profile (the user's own row; no incentive, no filter on
-- who is asked). Additive only.

alter table public.profiles
  add column if not exists review_prompted_at timestamptz,
  add column if not exists review_prompt_action text check (review_prompt_action is null or review_prompt_action in ('shown', 'opened', 'dismissed'));
