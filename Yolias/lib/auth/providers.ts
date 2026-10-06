import "server-only";

// Which sign-in providers the Yolias Supabase project has switched on
// (GoTrue's public /auth/v1/settings). The Google button shows only when
// Google is really enabled — never a button that can't work (rule 4).
let cached: { at: number; google: boolean } | null = null;
const TTL_MS = 60_000;

export async function googleSignInEnabled(): Promise<boolean> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.google;
  let google = false;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) google = Boolean(((await res.json()) as { external?: { google?: boolean } }).external?.google);
  } catch {}
  cached = { at: Date.now(), google };
  return google;
}
