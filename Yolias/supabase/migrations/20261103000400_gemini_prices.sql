-- gemini-3.8-flash paid-tier prices per 1M tokens, from
-- https://ai.google.dev/gemini-api/docs/pricing (checked 2026-10-06):
-- input $0.75, output $3.75 (incl. thinking), cached input $0.075 — valid
-- through 2026-12-31; Google doubles them on 2027-01-01 (update in Yolias
-- Admin → Platform → LLM). Only added when no price is set yet.
update intel.settings
set value = value || '{"gemini-3.8-flash": {"input": 0.75, "output": 3.75, "cache_read_multiplier": 0.1, "cache_write_multiplier": 1}}'::jsonb,
    updated_at = now()
where key = 'llm_prices' and not value ? 'gemini-3.8-flash';
