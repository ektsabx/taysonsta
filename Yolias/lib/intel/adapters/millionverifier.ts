import "server-only";
import type { ProviderAdapter } from "@/lib/intel/adapter";
import type { VerifyStatus } from "@/lib/intel/capabilities";

// MillionVerifier (D-248): email verification (email.verify). The key is set
// in Yolias Admin → Settings → Integrations → MillionVerifier and copied to
// the provider's Vault credential. One credit per check.
// API: GET https://api.millionverifier.com/api/v3/?api=KEY&email=…&timeout=10

const map: Record<string, VerifyStatus> = { ok: "valid", catch_all: "catch_all", unknown: "unknown", disposable: "risky", invalid: "invalid" };

export const millionVerifier: ProviderAdapter = {
  id: "millionverifier",
  name: "MillionVerifier",
  needsCredential: true,
  handlers: {
    "email.verify": async (input, ctx) => {
      const url = `https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(ctx.credential ?? "")}&email=${encodeURIComponent(input.email)}&timeout=10`;
      const r = await ctx.fetch({ url, timeoutMs: 20_000, retries: 1 });
      if (!r.ok) throw new Error(r.error ?? `MillionVerifier HTTP ${r.status}`);
      const body = (r.body ?? {}) as { result?: string; error?: string };
      if (body.error) throw new Error(`MillionVerifier: ${String(body.error).slice(0, 200)}`);
      return { data: { status: map[String(body.result ?? "")] ?? "unknown" }, units: 1 };
    },
  },
};
