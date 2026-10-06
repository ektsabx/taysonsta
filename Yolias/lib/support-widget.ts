import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// The support chat widget on the Yolias website (D-134). The widget is made
// in Yolias Admin (Settings → Integrations → Website widget, "Show on the
// Yolias website"); Admin writes { key, origin } to public.site_settings.
// Yolias serves it from its own domain (/support-widget/<key>/…) through a
// proxy, so the Admin domain never appears on the website.

export interface SupportWidget {
  key: string;
  /** Where this server reaches Yolias Admin. Never sent to the browser. */
  origin: string;
}

const TTL_MS = 60_000;
let cache: { at: number; value: SupportWidget | null } | null = null;

export async function supportWidget(): Promise<SupportWidget | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value: SupportWidget | null = null;
  try {
    // no-store: a widget switched on in Admin shows up within the minute.
    const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    });
    const { data } = await db.from("site_settings").select("value").eq("key", "support_widget").abortSignal(AbortSignal.timeout(5_000)).maybeSingle();
    const v = data?.value as { key?: unknown; origin?: unknown } | undefined;
    if (typeof v?.key === "string" && /^[0-9a-f]{16,64}$/.test(v.key) && typeof v.origin === "string" && /^https?:\/\/[^/\s]+$/.test(v.origin)) value = { key: v.key, origin: v.origin };
  } catch {
    value = cache?.value ?? null;
  }
  cache = { at: Date.now(), value };
  return value;
}
