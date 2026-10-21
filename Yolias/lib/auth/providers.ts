import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Which sign-in providers the Yolias Supabase project has switched on
// (GoTrue's public /auth/v1/settings). The Google button shows only when
// Google is really enabled, never a button that can't work (rule 4).
// A slow or failed check must not hide a working button: before 2026-10-21 a
// 3-second timeout on a cold start hid it for a minute. The last answer is
// kept in memory and in site_settings.auth_providers and used until a fresh
// check succeeds.
let cached: { at: number; google: boolean } | null = null;
const TTL_MS = 60_000;
const KEY = "auth_providers";

async function check(timeoutMs: number): Promise<boolean | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return Boolean(((await res.json()) as { external?: { google?: boolean } }).external?.google);
  } catch {
    return null;
  }
}

export async function googleSignInEnabled(): Promise<boolean> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.google;
  const fresh = (await check(4000)) ?? (await check(6000));
  if (fresh !== null) {
    if (cached?.google !== fresh) {
      await createAdminClient().from("site_settings").upsert({ key: KEY, value: { google: fresh }, updated_at: new Date().toISOString() }).then(() => {}, () => {});
    }
    cached = { at: Date.now(), google: fresh };
    return fresh;
  }
  // The check failed: the last known answer, from memory or the database.
  if (cached) return cached.google;
  const { data } = await createAdminClient().from("site_settings").select("value").eq("key", KEY).maybeSingle().then((r) => r, () => ({ data: null }));
  const known = Boolean((data?.value as { google?: boolean } | null)?.google);
  cached = { at: Date.now() - TTL_MS + 10_000, google: known }; // checked again within 10 seconds
  return known;
}
