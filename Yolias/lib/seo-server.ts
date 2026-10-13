import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

// Search engine ownership tokens (Yolias Admin → Integrations → Search
// Console; Admin writes them to site_settings "search_console"). Cached for a
// minute per server process; a missing or unreachable value adds nothing.

let memo: { at: number; value: { google: string | null; bing: string | null } } | null = null;

export const siteVerification = cache(async (): Promise<{ google: string | null; bing: string | null }> => {
  if (memo && Date.now() - memo.at < 60_000) return memo.value;
  let value = { google: null as string | null, bing: null as string | null };
  try {
    const { data } = await createAdminClient().from("site_settings").select("value").eq("key", "search_console").abortSignal(AbortSignal.timeout(3_000)).maybeSingle();
    const v = (data?.value ?? {}) as { google?: unknown; bing?: unknown };
    const clean = (x: unknown) => (typeof x === "string" && /^[A-Za-z0-9_-]{8,200}$/.test(x.trim()) ? x.trim() : null);
    value = { google: clean(v.google), bing: clean(v.bing) };
  } catch {
    value = memo?.value ?? value;
  }
  memo = { at: Date.now(), value };
  return value;
});
