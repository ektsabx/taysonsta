# 14 — Final Product Spec: execution plan (10 phases)

Source: the owner's "Yolias AI — Final Product & Development Specification"
(2026-10-05). Executed one phase at a time; a phase is done only when its
backend, database, API and UI work and are tested (spec §66). Anything the
spec removes is removed everywhere (DB, API, services, routes, types, UI,
settings, permissions, tests), never just hidden.

| # | Phase | Spec sections | Status |
| --- | --- | --- | --- |
| 1 | Removals & cleanup: voice/mic/STT; client portal; products & services; branches; cameras; social accounts; automation; projects; IT & external apps; multiple currencies; admin theme customization; header settings icon; WhatsApp/SMS/voice channels; their settings, permissions, routes, tables | 4, 34, 44–55 | done (D-119, D-120, D-121) |
| 2 | Platform basics: Microsoft Clarity, language by country, Google sign-in/up, currency rule (Egypt → EGP, else USD), same features on every plan, "No commitment · Cancel anytime" | 5, 8, 28, 29, 42, 54 | |
| 3 | Payments: provider-agnostic billing layer, Paymob adapter (server-side, keys in Vault), provider settings in Admin, Buy More Prospects | 1, 27, 62 | |
| 4 | Entity layer + search types: Person, Company, Local Business, Job; People / Companies / Local Businesses / Company Lookalikes with their own output schemas; standard intelligence fields (source, provenance, last updated, confidence, match score, missing data) | 11–14, 37 | |
| 5 | Prospects: tabs per entity, filter/search/sort, select / select all across pages, pagination, CSV export, detail, contact reveal, decision-maker matching | 9, 10, 15, 16, 25, 61 | |
| 6 | Campaigns: continuous discovery with goal + deadline + status, list, dashboard, internal navigation, campaign chat, run lineage, usage per campaign | 17–24, 26, 60, 61 | |
| 7 | Yolias AI: Claude-like chat thread, plan badge + Upgrade, message actions (copy, like, dislike, time), thinking states; conversations (user, workspace, campaign); orchestrator (Gemini research, Claude reasoning, small model for extraction); agent tools for every area; cost per call and per tool call | 6, 7, 35, 57–59, 63 | |
| 8 | Outreach: personalized message preparation + send architecture through connected integrations (no WhatsApp/SMS/voice) | 33, 34 | |
| 9 | Admin: Yolias design system only; content management (Help Center, Docs, Blog, website); notifications system; email templates/events management; LLM management; pricing & plans; ARPA; modules (risk, SEO, prospect intelligence, data operations, usage/credits, analytics) | 30, 31, 36, 38–41, 44, 62 | |
| 10 | Screenshot documentation (real screenshots + annotations in Docs/Help Center); full test matrix (§66); final report | 32, 56, 66 | |

## Decisions taken by the spec

| Decision | From the spec |
| --- | --- |
| D-007 payment provider | **Paymob** now, behind a provider-agnostic layer (Stripe later) |
| D-001 hosting | Cloudflare, keep the current deployment |
| D-111 email | Resend (needs the key — see below) |
| D-012 copy | WhatsApp / SMS / voice are not channels: remove those promises |
| D-009 mobile | Every plan has every feature; plans differ only in usage ⇒ phone/mobile (when available) on all plans |
| D-008 (partial) | Orchestrator: Gemini for research, Claude for reasoning, a smaller model for classification/extraction — exact model ids still needed |
| Currency | Egypt → EGP, every other country → USD; no other currencies |

## Still open (asked in chat)

- Resend API key + verified sending domain.
- Paymob credentials (API key, integration ids, iframe id, HMAC secret) and EGP prices per plan.
- "Credits" vs "Prospects": the spec shows credits used per campaign; rule 26 said customers see prospects only. Unit definition needed.
- Prospects/credits per plan (D-006) and Buy More packs (sizes, prices).
- Google OAuth client (id + secret) for the Yolias Supabase project.
- Data providers (D-003/D-004): company/person provider, email finder/verifier, Google Maps Places key.
- Model ids per task (D-008) and their prices.
- Production Supabase plan/region and domains (D-002/D-013).
