// One-time move to "one place for every key" (D-132), safe to run again:
//   node --import ./tests/integration/register.mjs scripts/integrations-to-yolias.ts
// 1) Paymob keys entered earlier on Platform → Payments become a Paymob
//    account in the Integration Hub (if the hub has none yet).
// 2) Every hub provider Yolias uses is copied to Yolias.
import { db } from "@/lib/bos/db";
import { encryptSecrets, secretHint } from "@/lib/bos/secrets";
import { ydb } from "@/lib/yolias/db";
import { pushToYolias } from "@/services/bos/integrations";

const { count } = await db().from("integration_connections").select("id", { count: "exact", head: true }).eq("provider", "paymob");
if (!count) {
  const { data: row } = await ydb().from("payment_providers").select("*").eq("id", "paymob").maybeSingle();
  const secret = async (name: string) => (await ydb().rpc("payment_secret", { p_provider: "paymob", p_name: name })).data as string | null;
  const secrets = { secret_key: await secret("secret_key"), hmac_secret: await secret("hmac_secret") };
  const cfg = (row?.config ?? {}) as { base_url?: string; public_key?: string; integrations?: { USD?: number[] } };
  if (secrets.secret_key && secrets.hmac_secret) {
    const s = secrets as Record<string, string>;
    const { error } = await db().from("integration_connections").insert({
      provider: "paymob", label: "Paymob", is_default: true, status: "active",
      config: { mode: row?.mode ?? "test", base_url: cfg.base_url ?? "https://accept.paymob.com", public_key: cfg.public_key ?? "", integrations_usd: (cfg.integrations?.USD ?? []).join(", ") },
      secret_ciphertext: await encryptSecrets(s), secret_hint: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, secretHint(v)])),
    });
    if (error) throw error;
    console.log("✓ Paymob moved into the Integration Hub");
  } else console.log("· Paymob has no keys yet — nothing to move");
}

for (const p of ["anthropic", "openai", "gemini", "yolias_google", "paymob"]) {
  await pushToYolias(p, null);
  console.log(`✓ ${p} synced to Yolias`);
}
