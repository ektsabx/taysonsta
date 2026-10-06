import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { ValidationError } from "@/lib/bos/errors";
import { ydb, yoliasConfigured } from "@/lib/yolias/db";
import type { ResolvedConnection } from "@/services/bos/integrations";

// One place for every key (owner decision, D-132): the Integration Hub
// (Settings → Integrations). For the providers Yolias uses, the hub's default
// active account is copied into the Yolias database — LLM and OAuth keys into
// public.integration_keys, Paymob into public.payment_providers — with the
// secrets in Supabase Vault. Yolias never reads these keys from anywhere else.

/** Hub provider → what it becomes in Yolias. */
const targets: Record<string, string> = { anthropic: "anthropic", openai: "openai", gemini: "gemini", yolias_google: "google_oauth", paymob: "paymob" };

export function usedByYolias(provider: string): boolean {
  return provider in targets;
}

function integrationIds(v: string | undefined): number[] {
  const parts = (v ?? "").split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
  if (parts.some((x) => !/^\d{1,12}$/.test(x))) throw new ValidationError("أرقام التكامل غير صالحة.", { integrations_usd: "أرقام مفصولة بفواصل" });
  return parts.map(Number);
}

/** Checks what Yolias needs before the hub saves a connection. */
export function checkForYolias(provider: string, config: Record<string, string>) {
  if (provider !== "paymob") return;
  if (config.mode !== "test" && config.mode !== "live") throw new ValidationError("الوضع غير صالح.", { mode: "تجريبي أو حقيقي" });
  const base = (config.base_url ?? "").replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+\.paymob\.com$/i.test(base)) throw new ValidationError("الرابط غير صالح.", { base_url: "رابط Paymob لمنطقة الحساب، مثل https://accept.paymob.com" });
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(config.public_key ?? "")) throw new ValidationError("المفتاح العام غير صالح.", { public_key: "كما يظهر في لوحة Paymob" });
  if (!integrationIds(config.integrations_usd).length) throw new ValidationError("أضف رقم تكامل واحداً على الأقل.", { integrations_usd: "مطلوب" });
}

/**
 * Copies a provider's active connection to Yolias (or removes it when there's
 * none). Skipped when the Yolias database isn't configured for this Admin.
 */
export async function syncToYolias(provider: string, conn: ResolvedConnection | null, bos: BosUser | null): Promise<void> {
  const target = targets[provider];
  if (!target || !yoliasConfigured()) return;
  const by = bos?.email ?? "system";
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    if (error) throw new ValidationError(`حُفظ الحساب لكن تعذّر نقله إلى يولياس: ${error.message}`);
  };

  if (target === "paymob") {
    if (!conn) {
      await run(ydb().from("payment_providers").update({ enabled: false, updated_by: by, updated_at: new Date().toISOString() }).eq("id", "paymob"));
      await run(ydb().rpc("clear_payment_secret", { p_provider: "paymob", p_name: "secret_key" }));
      await run(ydb().rpc("clear_payment_secret", { p_provider: "paymob", p_name: "hmac_secret" }));
      return;
    }
    const c = conn.connection.config as Record<string, string>;
    await run(ydb().rpc("set_payment_secret", { p_provider: "paymob", p_name: "secret_key", p_secret: conn.secrets.secret_key }));
    await run(ydb().rpc("set_payment_secret", { p_provider: "paymob", p_name: "hmac_secret", p_secret: conn.secrets.hmac_secret }));
    await run(ydb().from("payment_providers").update({
      enabled: true,
      mode: c.mode === "live" ? "live" : "test",
      config: { base_url: (c.base_url ?? "").replace(/\/+$/, ""), public_key: c.public_key ?? "", integrations: { USD: integrationIds(c.integrations_usd) } },
      updated_by: by,
      updated_at: new Date().toISOString(),
    }).eq("id", "paymob"));
    return;
  }

  if (!conn) {
    await run(ydb().rpc("clear_integration_keys", { p_provider: target }));
    return;
  }
  const config = Object.fromEntries(Object.entries(conn.connection.config as Record<string, string>).filter(([k]) => k !== "model"));
  await run(ydb().rpc("set_integration_keys", { p_provider: target, p_config: config, p_secrets: conn.secrets, p_by: by }));
}
