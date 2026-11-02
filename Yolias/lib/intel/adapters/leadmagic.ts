import "server-only";
import type { ProviderAdapter } from "@/lib/intel/adapter";

// LeadMagic (D-273), checked against leadmagic.io's Email Finder API guide on 2026-11-02.
//  email.find  POST https://api.leadmagic.io/v1/people/email-finder  { full_name, domain }
//              → { email, status: "valid" | null, credits_consumed }
// Auth: X-API-Key header. Failed lookups are free (leadmagic.io/pricing); the
// units are what LeadMagic says it charged. Its validation and role-finder
// endpoints aren't used until their request and response are confirmed in the
// official reference (rule 3). Disabled until Admin adds the key.

export const leadmagic: ProviderAdapter = {
  id: "leadmagic",
  name: "LeadMagic",
  needsCredential: true,
  handlers: {
    "email.find": async (input, ctx) => {
      if (!input.company.domain) return { data: null, units: 0 };
      const r = await ctx.fetch({ url: "https://api.leadmagic.io/v1/people/email-finder", method: "POST", headers: { "X-API-Key": ctx.credential ?? "", "Content-Type": "application/json" }, body: { full_name: input.person.fullName, domain: input.company.domain }, timeoutMs: 30_000, retries: 2 });
      if (!r.ok) throw new Error(r.error ?? `LeadMagic HTTP ${r.status}`);
      const b = (r.body ?? {}) as { email?: string | null; status?: string | null; credits_consumed?: number };
      const units = Number(b.credits_consumed ?? 0) || 0;
      return b.email && b.status === "valid" ? { data: { email: b.email.toLowerCase(), confidence: 0.9 }, units } : { data: null, units };
    },
  },
};
