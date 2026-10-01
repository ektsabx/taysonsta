# 00 — Vision

## What Yolias is

**Yolias is a Prospect Intelligence & Discovery Platform.** The user describes,
in Arabic or English, typed or spoken, who they want to sell to. Yolias
understands the request, discovers matching companies, finds the right
decision makers, enriches and verifies their contact data, scores how well
each one fits, and delivers prospects with clear reasons and sources.

> "Tell Yolias who you want to sell to."

## What Yolias is not

- Not a CRM, not an outreach tool, not a sequencer.
- No email sending, no WhatsApp messaging, no browser automation.
- No unauthorized scraping.
- Not a wrapper around one data provider. PDL, Coresignal and every other source are **providers**, never "the system".
- Not a generic BOS. The customer app stays focused; business operations live in Yolias Admin.

## Platform shape

```text
Yolias (customer app)              Yolias Admin
        │                                │
        └──────────────┬─────────────────┘
                       ▼
              Intelligence Layer
     (registry · routing · cache · provenance · cost)
                       │
     ┌─────────────────┼──────────────────┐
     ▼                 ▼                  ▼
 Discovery         Enrichment        Verification
 providers         providers         providers
```

Multi-source from day one. Any provider can be added, removed, disabled or
replaced without changing the product.

## Customer product

Navigation (keep it; do not restructure the product without a decision):

- **Yolias AI**: the conversational entry point and agent.
- **Analytics**
- **Campaigns**: discovery jobs and their progress.
- **Prospects**: delivered results.
- **Recent Searches** / **New Search**: the user's searches (data model: `strategies`).

Voice follows the same pipeline as text: Voice → STT → text → the same parser.

## What a Prospect is

A prospect is a real decision maker at a company that matches the ICP,
with enough data to act on. Fields:

- **Person**: full name, title, seniority, department, LinkedIn and other
  public social profiles, work email + verification status, phone/mobile
  (optional), city, country.
- **Company**: name, domain, industry, size, location, description,
  funding, hiring and tech signals, social profiles.
- **Quality**: match score (0–100) with human-readable reasons, per-field
  source (provenance), confidence, freshness date.

Rules:
- **Mobile is not mandatory.** A prospect without a mobile is still a prospect.
- Never claim a "verified WhatsApp". At most: a number exists, from source X.
- Never show a field as verified unless a verifier said so.
- Show partial data honestly. No fake completeness.

## Results experience

- Score with reasons, for example: `92% · ✓ Industry SaaS · ✓ 50–200 employees · ✓ Riyadh · ✓ CTO`.
- Source transparency: where each field came from and when.
- Real progress per stage. No fake progress bars.
- Partial results are explained ("found 37 of 100: Riyadh fintechs under 50 people are rare").

## Customer usage language

The customer sees **Prospects used: X / Y**. Never "credits", never provider
names in billing, never internal cost.

## Success criteria

- Search → prospects end to end, in Arabic and English, text or voice.
- More than one provider live, with routing and fallback.
- Shared intelligence reused across workspaces, so repeat searches get cheaper.
- Every provider call and LLM call costed and attributable to a workspace and campaign.
- Healthy unit economics: cost per prospect well under price per prospect for each plan.
- The admin shows real platform, provider, cost and business metrics.
