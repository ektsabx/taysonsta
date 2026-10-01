# 01 — Rules (non-negotiable)

Every change, by a human or an AI, follows these rules. If a task seems to
need breaking one, stop and ask the owner. Log the answer in `12-decisions.md`.

## Working rules

1. **Read the existing code first.** Extend what exists. Don't rewrite working parts.
2. **Don't invent requirements.** If the docs don't say it, it is an open decision.
3. **Don't assume an API exists.** Verify endpoints, fields, pricing and terms against the provider's official docs before writing an adapter.
4. **No fake integrations.** No mock providers presented as real, no placeholder data shown as results, no fake metrics. If something isn't connected, say "not connected".
5. **Don't overbuild.** No outreach, sequences, WhatsApp messaging, browser automation or scraping. No speculative abstractions beyond the current phase.
6. **Keep the existing UI and product structure.** Change it only by decision.
7. **Both apps stay bilingual (AR/EN, RTL).** Every user-facing string goes through the dictionaries.
8. **Next.js in this repo is v16** with breaking changes. Check `node_modules/next/dist/docs/` before writing Next code (see `AGENTS.md`).
9. **Verify before you push:** typecheck, lint, unit tests, build. Run the affected flow in a browser when it is UI.
10. **Document as you go:** update `11-current-state.md`, `10-roadmap.md`, `12-decisions.md`.

## Architecture rules

11. **Provider-agnostic, always.** Product code talks to the Intelligence Layer, never to a provider SDK. Path: Intelligence Service → Adapter → Provider.
12. **No single-provider lock-in.** The first provider is the "first production-grade integration", not the architecture.
13. **Capabilities are declarative.** Routing picks providers by declared capability, not by name in code.
14. **Prices, limits and licenses are configuration** in the provider registry, never hardcoded.
15. **Cheapest valid path.** Follow the ladder: shared DB → code → public sources → paid providers → LLM.
16. **Filter before you pay; pay on success.** Qualify companies before buying people. Buy contacts only for qualified people. Mobile only after qualification. Website research only when it adds something.
17. **No unnecessary calls.** Check the cache and shared data first. Every call has a reason.
18. **Every job is idempotent, retryable and observable.**
19. **Respect licenses.** Data is stored, shown, shared, derived and retained only as its provider's license allows (`license_scope` and friends).
20. **Provenance on every field:** source, time, confidence.
21. **Freshness via TTLs.** Stale data is refreshed or flagged, never silently served as current.
22. **Uncertain duplicates are not merged.** Mark them `possible_duplicate`.

## LLM rules

23. **LLM only where it adds value:** understanding the ICP, classifying unknown industries or titles, extracting from team pages, research summaries, explanations.
24. **Never use an LLM for:** dedup, scoring, filtering, sorting, normalisation, email validation, quota, usage, routing, matching. These are code.
25. **Cost discipline:** cache by fingerprint, prompt caching, batch where latency allows, the smallest model that passes evals, structured outputs, trimmed inputs. No model lock-in.

## Money rules

26. **Customers see Prospects, never credits.**
27. **Usage is reserved atomically before work and consumed on delivery.** Never trust the frontend for quota.
28. **Every provider and LLM call is logged with its cost**, attributed to workspace and campaign.
29. **Quotas are configuration.** Pricing decision: to protect margins, lower Prospects per plan rather than raise prices.

## Security rules

30. **No keys in the browser.** Provider credentials live in Vault (server-side only).
31. **No RLS bypass for user requests.** The service role is for workers and admin server code only, and it scopes queries explicitly.
32. **Never trust the frontend** for permissions, quota or prices.
33. **Agent security never relies on the prompt.** Tools enforce authorization: user → workspace → role → permission → resource → action.
34. **Suppression list is honoured** everywhere a person could be delivered.
35. **Audit** admin actions, credential changes and agent tool calls.

## Admin rules

36. **Taysonsta Pages / BOS is the foundation of Yolias Admin.** Keep all of its modules. Don't discard or break them.
37. **We want both:** the existing company modules and the new platform modules.
38. **Same design language as Yolias, admin-specific information architecture.** Not a copy of the customer UI.
39. **Show only real metrics.** A metric with no data source is hidden or marked "not connected".
