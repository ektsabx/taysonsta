import "server-only";
import type { ProviderAdapter } from "@/lib/intel/adapter";
import type { VerifyStatus } from "@/lib/intel/capabilities";
import type { PersonCandidate } from "@/lib/discovery/types";

// Hunter (D-273), checked against https://hunter.io/api-documentation/v2 on 2026-11-02.
//  person.search  GET /v2/domain-search?domain=&seniority=senior,executive&limit=  (people with their emails at a domain)
//  email.find     GET /v2/email-finder?domain=&full_name=
//  email.verify   GET /v2/email-verifier?email=
// Auth: api_key query parameter. Credits (hunter.io/pricing): 1 per email found
// (finder, domain search), 0.5 per verification. Prices live in the registry
// (Admin → Providers), never here. 451 = the person asked Hunter not to share
// their email: treated as no result. Disabled until Admin adds the key.

const BASE = "https://api.hunter.io/v2";
const verifyMap: Record<string, VerifyStatus> = { valid: "valid", invalid: "invalid", accept_all: "catch_all", webmail: "risky", disposable: "risky", unknown: "unknown" };
const q = (o: Record<string, string | number | undefined>) => Object.entries(o).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");

export const hunter: ProviderAdapter = {
  id: "hunter",
  name: "Hunter",
  needsCredential: true,
  handlers: {
    "person.search": async (input, ctx) => {
      if (!input.company.domain) return { data: [], units: 0 };
      const r = await ctx.fetch({ url: `${BASE}/domain-search?${q({ domain: input.company.domain, seniority: "senior,executive", type: "personal", limit: Math.min(Math.max(input.limit, 1), 10), api_key: ctx.credential ?? "" })}`, timeoutMs: 20_000, retries: 2 });
      if (r.status === 451) return { data: [], units: 0 };
      if (!r.ok) throw new Error(r.error ?? `Hunter HTTP ${r.status}`);
      const emails = ((r.body as { data?: { emails?: unknown[] } } | null)?.data?.emails ?? []) as { value?: string; first_name?: string | null; last_name?: string | null; position?: string | null; linkedin?: string | null; confidence?: number | null; phone_number?: string | null }[];
      const people: PersonCandidate[] = emails.filter((e) => e.value && (e.first_name || e.last_name)).map((e) => ({
        fullName: [e.first_name, e.last_name].filter(Boolean).join(" "), title: e.position ?? null, email: e.value!.toLowerCase(), phone: e.phone_number ?? null,
        linkedinUrl: e.linkedin && /^https:\/\//.test(e.linkedin) ? e.linkedin : null, city: null, country: input.company.country, sourceRef: e.value!,
        confidence: typeof e.confidence === "number" ? Math.min(Math.max(e.confidence / 100, 0), 1) : null, raw: e,
      }));
      return { data: people, units: people.length };
    },
    "email.find": async (input, ctx) => {
      if (!input.company.domain) return { data: null, units: 0 };
      const r = await ctx.fetch({ url: `${BASE}/email-finder?${q({ domain: input.company.domain, full_name: input.person.fullName, api_key: ctx.credential ?? "" })}`, timeoutMs: 25_000, retries: 1 });
      if (r.status === 451 || r.status === 404) return { data: null, units: 0 };
      if (!r.ok) throw new Error(r.error ?? `Hunter HTTP ${r.status}`);
      const d = (r.body as { data?: { email?: string | null; score?: number | null } } | null)?.data;
      return d?.email ? { data: { email: d.email.toLowerCase(), confidence: typeof d.score === "number" ? d.score / 100 : null }, units: 1 } : { data: null, units: 0 };
    },
    "email.verify": async (input, ctx) => {
      const r = await ctx.fetch({ url: `${BASE}/email-verifier?${q({ email: input.email, api_key: ctx.credential ?? "" })}`, timeoutMs: 25_000, retries: 2 });
      if (r.status === 451) return { data: { status: "unknown" }, units: 0 };
      if (!r.ok) throw new Error(r.error ?? `Hunter HTTP ${r.status}`);
      const st = (r.body as { data?: { status?: string } } | null)?.data?.status ?? "unknown";
      return { data: { status: verifyMap[st] ?? "unknown" }, units: 1 };
    },
  },
};
