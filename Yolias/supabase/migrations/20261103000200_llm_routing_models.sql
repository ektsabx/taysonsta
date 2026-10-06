-- Gemini 2.5 models are no longer offered to new Google AI accounts (the API
-- answers 404 and points to gemini-3.8-flash). Routes move to the current
-- model, and Gemini becomes the fallback of the default task, so Yolias AI
-- works with whichever of Claude / Gemini is connected. Editable in Yolias
-- Admin → Platform → LLM.
update intel.settings
set value = replace(replace(value::text, '"gemini-2.5-flash"', '"gemini-3.8-flash"'), '"gemini-2.5-pro"', '"gemini-3.8-flash"')::jsonb,
    updated_at = now()
where key = 'llm_routing';

update intel.settings
set value = jsonb_set(value, '{default}', coalesce(value -> 'default', '[]'::jsonb) || '[{"provider": "gemini", "model": "gemini-3.8-flash"}]'::jsonb),
    updated_at = now()
where key = 'llm_routing'
  and not coalesce(value -> 'default', '[]'::jsonb) @> '[{"provider": "gemini"}]'::jsonb;
