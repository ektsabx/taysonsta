import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/seo";
import { classify, decodeFirstTouch, type FirstTouch } from "./attribution";

/** Stores where a new account came from, once (D-257). Returns what was stored. */
export async function recordSignupSource(userId: string, cookie: string | undefined, requestHost: string): Promise<{ channel: string; landing: string | null }> {
  const ft: FirstTouch | null = decodeFirstTouch(cookie);
  const self = [requestHost, new URL(siteUrl()).hostname, "yolias.com", "www.yolias.com"];
  const { channel, engine } = classify(ft, self);
  const { error } = await createAdminClient().from("signup_attribution").upsert({
    user_id: userId,
    landing_path: ft?.l ?? null,
    referrer_host: ft && !self.includes(ft.r) ? ft.r || null : null,
    channel,
    search_engine: engine,
    utm_source: ft?.us ?? null,
    utm_medium: ft?.um ?? null,
    utm_campaign: ft?.uc ?? null,
    first_seen_at: ft ? new Date(ft.t * 1000).toISOString() : null,
  }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) console.error("signup_attribution", error.message);
  return { channel, landing: ft?.l ?? null };
}
