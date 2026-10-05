-- LLM routing with fallback across providers (D-118): order per task, edited
-- in Yolias Admin. Claude only until another provider's key and model are set.
insert into intel.settings (key, value) values
  ('llm_routing', '{"default": [{"provider": "anthropic", "model": "claude-opus-5-5"}]}')
on conflict (key) do nothing;
