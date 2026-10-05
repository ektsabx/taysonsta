# 07 — LLM & Yolias AI Agent

## Where the LLM is allowed

| Task | Why an LLM |
| --- | --- |
| ICP understanding (AR/EN, typed or voice) | free text → structured criteria |
| Classifying unknown industries / titles | long tail the code tables miss (result cached) |
| Extracting people from team/about pages | unstructured HTML |
| Research summary of a company | optional, only for qualified companies |
| Explanations to the user | "why this prospect", "why partial" |

**Never:** dedup, scoring, filtering, sorting, normalisation, email
validation, quota, usage, routing, matching.

## Cost & quality

- Cache by fingerprint (`intel.llm_cache`); same ICP ⇒ no new call.
- Prompt caching for stable system prompts and schemas.
- Batch API for non-interactive work (research, classification).
- Smallest model that passes the eval set; models are config, no lock-in.
- Structured outputs (zod schemas) for every extraction.
- Input hygiene: strip HTML, truncate, send only needed fields.
- Bilingual eval set (Arabic dialects + English) run on every model or prompt change.

Today: ICP parsing uses the Anthropic SDK with structured parsing (`Yolias/lib/ai/strategy.ts`).

## ICP record

Stored on the strategy: normalised ICP, fingerprint, model, prompt version,
interpretation cost, constraints, assumptions, metadata.

## Agent persona

Professional, direct, concise. Arabic or English, matching the user. Never
hallucinates; says "I don't know" or "that data isn't available" plainly.

### Can

Search; show and modify searches ("make it Saudi"); explain results and
scores; filter; analyse; explain missing data; start campaigns; report real
status; explain provenance; enrich a prospect (if quota/permission allows).

### Must not

Invent data; claim verification that didn't happen; exceed licenses or
permissions; scrape; misuse the LLM for code tasks; trigger expensive
enrichment without need; consume quota without logging.

## Tools

`searchProspects`, `getCampaign`, `getProspect`, `filterProspects`,
`enrichProspect`, `researchCompany`, `getAnalytics`, `getUsage`,
`getStrategy`, `createCampaign`.

Every tool is: typed (zod input/output), **authorized in code**
(user → workspace → role → permission → resource → action), workspace-scoped,
usage-accounted, audited. The system prompt is not a security boundary.

Built (`Yolias/lib/agent/`):

- `authz.ts`: role → permission table and `authorize()` (inactive workspace,
  missing permission, foreign resource ⇒ denied).
- `tools.ts`: the tools above. They run with the user's Supabase client, so
  RLS still applies; each checks the resource's workspace itself too.
  `executeTool()` validates, authorizes, runs and writes one row to
  `public.agent_tool_calls` (outcome `ok | denied | invalid | not_found |
  not_connected | error`). `createCampaign` reuses the search-box flow
  (`lib/discovery/launch.ts`), so quota is reserved by the worker as usual.
  `enrichProspect` / `researchCompany` return `not_connected` until a
  provider for that capability exists (phases 4/7).
- `run.ts`: Claude tool runner (`toolRunner` + `betaTool`), max 8 iterations,
  cached system prompt, server-side fallback. Each model call is logged in
  `intel.llm_calls` (task `agent`) with its cost.
- `app/api/agent`: signed-in only; the body is text turns only.
- Chat UI: not built, waits on D-115.

## Conversation behaviour

- Keeps context across turns: "make it Saudi" edits the current search.
- Real progress only; partial results explained.
- States uncertainty and data sources honestly.
