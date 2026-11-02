import "server-only";
import type { ProviderAdapter } from "@/lib/intel/adapter";

// Findymail (D-273), checked against https://www.findymail.com/api/ on 2026-11-02.
//  email.find    POST https://app.findymail.com/api/search/name  { name, domain }  → contact.email
//  email.verify  POST https://app.findymail.com/api/verify       { email }         → verified (boolean)
// Auth: Authorization: Bearer <key>. Credits (findymail.com/pricing): charged
// only for verified results; one finder credit per email. Prices live in the
// registry. Disabled until Admin adds the key.

const BASE = "https://app.findymail.com/api";

export const findymail: ProviderAdapter = {
  id: "findymail",
  name: "Findymail",
  needsCredential: true,
  handlers: {
    "email.find": async (input, ctx) => {
      if (!input.company.domain) return { data: null, units: 0 };
      const r = await ctx.fetch({ url: `${BASE}/search/name`, method: "POST", headers: { Authorization: `Bearer ${ctx.credential ?? ""}`, "Content-Type": "application/json" }, body: { name: input.person.fullName, domain: input.company.domain }, timeoutMs: 30_000, retries: 1 });
      if (r.status === 404) return { data: null, units: 0 };
      if (!r.ok) throw new Error(r.error ?? `Findymail HTTP ${r.status}`);
      const email = (r.body as { contact?: { email?: string | null } } | null)?.contact?.email;
      // Findymail returns only verified emails.
      return email ? { data: { email: email.toLowerCase(), confidence: 0.95 }, units: 1 } : { data: null, units: 0 };
    },
    "email.verify": async (input, ctx) => {
      const r = await ctx.fetch({ url: `${BASE}/verify`, method: "POST", headers: { Authorization: `Bearer ${ctx.credential ?? ""}`, "Content-Type": "application/json" }, body: { email: input.email }, timeoutMs: 30_000, retries: 1 });
      if (!r.ok) throw new Error(r.error ?? `Findymail HTTP ${r.status}`);
      const v = (r.body as { verified?: boolean } | null)?.verified;
      return { data: { status: v === true ? "valid" : v === false ? "invalid" : "unknown" }, units: 1 };
    },
  },
};
