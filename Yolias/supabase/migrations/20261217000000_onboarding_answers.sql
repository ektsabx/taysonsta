-- D-276 (owner, 2026-11-03): answers to the onboarding questions the owner
-- adds in Yolias Admin (lib/onboarding/steps.ts), per step and question.
-- Written by the server when onboarding is completed; shown in Admin.
alter table public.profiles add column if not exists onboarding_answers jsonb;
